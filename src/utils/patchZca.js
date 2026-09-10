const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const logger = require('./logger');

/**
 * Vá lỗi uploadAttachment trong thư viện zca-js:
 * 1. Trong zca-js gốc, khi upload video hoặc file nhiều chunk (mp4, mp3 > 2MB),
 *    mỗi chunk đều tạo new Promise và ghi đè callback trong ctx.uploadCallbacks.
 *    Khi Zalo gửi sự kiện file_done (chỉ 1 lần), chỉ chunk cuối cùng được giải quyết,
 *    khiến Promise.all([chunk0, chunk1, ...]) bị treo vô thời hạn.
 * 2. zca-js gốc không có timeout nếu WebSocket bị rớt gói hoặc Zalo xử lý trễ,
 *    khiến hàm sendMessage chứa video bị kẹt mãi mãi.
 * 3. Bản vá này đảm bảo upload tất cả các chunk và chỉ đợi 1 callback file_done duy nhất kèm timeout 45 giây.
 */
function applyZcaPatches(api) {
  if (!api || typeof api.uploadAttachment !== 'function') return;

  const ctx = api.listener?.ctx;
  if (!ctx || !ctx.settings?.features?.sharefile) {
    logger.warn('[PATCH] Không tìm thấy ctx hoặc sharefile features, giữ nguyên uploadAttachment gốc');
    return;
  }

  let ZaloApiError, Enum, utils;
  try {
    ZaloApiError = require(path.resolve('node_modules/zca-js/dist/cjs/Errors/ZaloApiError.cjs')).ZaloApiError;
    Enum = require(path.resolve('node_modules/zca-js/dist/cjs/models/Enum.cjs'));
    utils = require(path.resolve('node_modules/zca-js/dist/cjs/utils.cjs'));
  } catch (err) {
    logger.warn('[PATCH] Không thể nạp module zca-js để vá lỗi uploadAttachment:', err.message);
    return;
  }

  // Tạo các helper đã liên kết với ctx để gọi makeURL, encodeAES, request đúng tham số
  const boundUtils = {
    makeURL(baseURL, params, apiVersion) {
      return utils.makeURL(ctx, baseURL, params, apiVersion);
    },
    encodeAES(data, t) {
      return utils.encodeAES(ctx.secretKey, data, t);
    },
    request(url, options, raw) {
      return utils.request(ctx, url, options, raw);
    },
  };

  const serviceURL = `${api.zpwServiceMap.file[0]}/api`;
  const { sharefile } = ctx.settings.features;

  function isExceedMaxFile(totalFile) {
    return totalFile > sharefile.max_file;
  }
  function isExceedMaxFileSize(fileSize) {
    return fileSize > sharefile.max_size_share_file_v3 * 1024 * 1024;
  }
  function isExtensionValid(ext) {
    return sharefile.restricted_ext_file.indexOf(ext) === -1;
  }

  const urlType = {
    image: 'photo_original/upload',
    video: 'asyncfile/upload',
    others: 'asyncfile/upload',
  };

  api.uploadAttachment = async function fixedUploadAttachment(sources, threadId, type = Enum.ThreadType.User) {
    if (!sources) throw new ZaloApiError('Missing sources');
    if (!Array.isArray(sources)) sources = [sources];
    if (sources.length === 0) throw new ZaloApiError('Missing sources');
    if (isExceedMaxFile(sources.length)) {
      throw new ZaloApiError('Exceed maximum file of ' + sharefile.max_file);
    }
    if (!threadId) throw new ZaloApiError('Missing threadId');

    const chunkSize = ctx.settings.features.sharefile.chunk_size_file || (2 * 1024 * 1024);
    const isGroupMessage = type === Enum.ThreadType.Group;
    const attachmentsData = [];
    const url = `${serviceURL}/${isGroupMessage ? 'group' : 'message'}/`;
    const typeParam = isGroupMessage ? '11' : '2';
    let clientId = Date.now();

    for (const source of sources) {
      const isFilePath = typeof source === 'string';
      const isBuffer = typeof source === 'object' && source.data instanceof Buffer;
      if (!isFilePath && !isBuffer) throw new ZaloApiError('Invalid source type');
      if (!isFilePath && !source.filename) throw new ZaloApiError('Missing filename');
      if (isFilePath && !fs.existsSync(source)) throw new ZaloApiError('File not found');

      const extFile = utils.getFileExtension(isFilePath ? source : source.filename).toLowerCase();
      const fileName = isFilePath ? utils.getFileName(source) : source.filename;
      if (isExtensionValid(extFile) === false) {
        throw new ZaloApiError(`File extension "${extFile}" is not allowed`);
      }

      const data = {
        filePath: isFilePath ? source : source.filename,
        chunkContent: [],
        params: {},
        source,
      };

      if (isGroupMessage) data.params.grid = threadId;
      else data.params.toid = threadId;

      switch (extFile) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'webp': {
          const imageData = isFilePath ? await utils.getImageMetaData(ctx, source) : Object.assign(Object.assign({}, source.metadata), { fileName });
          if (isExceedMaxFileSize(imageData.totalSize)) {
            throw new ZaloApiError(`File ${fileName} size exceed maximum size of ${sharefile.max_size_share_file_v3}MB`);
          }
          data.fileData = imageData;
          data.fileType = 'image';
          data.params.totalChunk = Math.ceil(data.fileData.totalSize / chunkSize);
          data.params.fileName = fileName;
          data.params.clientId = clientId++;
          data.params.totalSize = imageData.totalSize;
          data.params.imei = ctx.imei;
          data.params.isE2EE = 0;
          data.params.jxl = 0;
          data.params.chunkId = 1;
          break;
        }
        case 'mp4': {
          const videoSize = isFilePath ? await utils.getFileSize(source) : source.metadata.totalSize;
          if (isExceedMaxFileSize(videoSize)) {
            throw new ZaloApiError(`File ${fileName} size exceed maximum size of ${sharefile.max_size_share_file_v3}MB`);
          }
          data.fileType = 'video';
          data.fileData = {
            fileName,
            totalSize: videoSize,
          };
          data.params.totalChunk = Math.ceil(data.fileData.totalSize / chunkSize);
          data.params.fileName = fileName;
          data.params.clientId = clientId++;
          data.params.totalSize = videoSize;
          data.params.imei = ctx.imei;
          data.params.isE2EE = 0;
          data.params.jxl = 0;
          data.params.chunkId = 1;
          break;
        }
        default: {
          const fileSize = isFilePath ? await utils.getFileSize(source) : source.metadata.totalSize;
          if (isExceedMaxFileSize(fileSize)) {
            throw new ZaloApiError(`File ${fileName} size exceed maximum size of ${sharefile.max_size_share_file_v3}MB`);
          }
          data.fileType = 'others';
          data.fileData = {
            fileName,
            totalSize: fileSize,
          };
          data.params.totalChunk = Math.ceil(data.fileData.totalSize / chunkSize);
          data.params.fileName = fileName;
          data.params.clientId = clientId++;
          data.params.totalSize = fileSize;
          data.params.imei = ctx.imei;
          data.params.isE2EE = 0;
          data.params.jxl = 0;
          data.params.chunkId = 1;
          break;
        }
      }

      const fileBuffer = isFilePath ? await fs.promises.readFile(source) : source.data;
      for (let i = 0; i < data.params.totalChunk; i++) {
        const formData = new FormData();
        const slicedBuffer = fileBuffer.subarray(i * chunkSize, (i + 1) * chunkSize);
        formData.append('chunkContent', slicedBuffer, {
          filename: fileName,
          contentType: 'application/octet-stream',
        });
        data.chunkContent[i] = formData;
      }
      attachmentsData.push(data);
    }

    const results = [];
    for (let atmIndex = 0; atmIndex < attachmentsData.length; atmIndex++) {
      const data = attachmentsData[atmIndex];
      let lastResData = null;

      if (data.fileType === 'image') {
        // Upload image chunks
        for (let i = 0; i < data.params.totalChunk; i++) {
          const encryptedParams = boundUtils.encodeAES(JSON.stringify(data.params));
          if (!encryptedParams) throw new ZaloApiError('Failed to encrypt message');
          const requestUrl = boundUtils.makeURL(url + urlType[data.fileType], { type: typeParam, params: encryptedParams });
          const response = await boundUtils.request(
            requestUrl,
            {
              method: 'POST',
              headers: data.chunkContent[i].getHeaders(),
              body: data.chunkContent[i].getBuffer(),
            }
          );
          const resData = await utils.resolveResponse(ctx, response);
          if (resData && resData.fileId != '-1' && resData.photoId != '-1') {
            results[atmIndex] = {
              fileType: 'image',
              width: data.fileData.width,
              height: data.fileData.height,
              totalSize: data.fileData.totalSize,
              hdSize: data.fileData.totalSize,
              finished: resData.finished,
              normalUrl: resData.normalUrl,
              hdUrl: resData.hdUrl,
              thumbUrl: resData.thumbUrl,
              chunkId: resData.chunkId,
              photoId: resData.photoId,
              clientFileId: resData.clientFileId,
            };
          }
          data.params.chunkId++;
        }
      } else {
        // Video hoặc file âm thanh/khác
        let fileId = null;
        let timeoutTimer = null;

        const uploadWsPromise = new Promise((resolve, reject) => {
          timeoutTimer = setTimeout(() => {
            if (fileId) ctx.uploadCallbacks.delete(String(fileId));
            reject(new Error(`Timeout (45s) đợi Zalo xử lý tệp ${data.fileData.fileName}`));
          }, 45000);

          const uploadCallback = async (wsData) => {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            try {
              const checksum = (await utils.getMd5LargeFileObject(data.source, data.fileData.totalSize)).data;
              const result = Object.assign(
                { fileType: data.fileType },
                lastResData,
                wsData,
                {
                  totalSize: data.fileData.totalSize,
                  fileName: data.fileData.fileName,
                  checksum,
                }
              );
              results[atmIndex] = result;
              resolve(result);
            } catch (err) {
              reject(err);
            }
          };

          data.__setCallback = (fId) => {
            fileId = fId;
            ctx.uploadCallbacks.set(String(fId), uploadCallback);
          };
        });

        // Upload tất cả các chunks
        for (let i = 0; i < data.params.totalChunk; i++) {
          const encryptedParams = boundUtils.encodeAES(JSON.stringify(data.params));
          if (!encryptedParams) {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            throw new ZaloApiError('Failed to encrypt message');
          }
          const requestUrl = boundUtils.makeURL(url + urlType[data.fileType], { type: typeParam, params: encryptedParams });
          const response = await boundUtils.request(
            requestUrl,
            {
              method: 'POST',
              headers: data.chunkContent[i].getHeaders(),
              body: data.chunkContent[i].getBuffer(),
            }
          );
          const resData = await utils.resolveResponse(ctx, response);
          if (resData && resData.fileId && resData.fileId != '-1') {
            lastResData = resData;
            if (i === 0 && typeof data.__setCallback === 'function') {
              data.__setCallback(resData.fileId);
            }
          }
          data.params.chunkId++;
        }

        // Đợi WebSocket callback file_done
        await uploadWsPromise;
      }
    }

    return results;
  };

  logger.info('[PATCH] Đã áp dụng bản vá sửa lỗi treo uploadAttachment (video & audio multi-chunk) thành công!');
}

module.exports = {
  applyZcaPatches,
};
