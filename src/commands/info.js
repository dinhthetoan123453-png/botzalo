const { ThreadType } = require('zca-js');

module.exports = {
  name: 'info',
  description: 'Hien thi thong tin nguoi gui va cuoc tro chuyen',
  usage: '!info',
  async execute({ api, message, threadId, threadType }) {
    const senderName = message.data.dName || 'Khong xac dinh';
    const senderUid = message.data.uidFrom || 'Khong ro';
    const chatType = threadType === ThreadType.Group ? 'Nhom chat' : 'Tin nhan rieng (1-1)';

    const replyMsg = `THONG TIN CUOC TRO CHUYEN:\n` +
      `- Nguoi gui: ${senderName}\n` +
      `- UID Zalo: ${senderUid}\n` +
      `- Loai hoi thoai: ${chatType}\n` +
      `- ID Thread: ${threadId}\n` +
      `- ID Tin nhan: ${message.data.msgId || 'N/A'}`;

    await api.sendMessage(
      {
        msg: replyMsg,
        quote: message.data,
      },
      threadId,
      threadType
    );
  },
};
