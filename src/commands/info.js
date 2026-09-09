const { ThreadType } = require('zca-js');

module.exports = {
  name: 'info',
  description: 'Hiển thị thông tin người gửi và cuộc trò chuyện',
  usage: '!info',
  async execute({ api, message, threadId, threadType }) {
    const senderName = message.data.dName || 'Không xác định';
    const senderUid = message.data.uidFrom || 'Không rõ';
    const chatType = threadType === ThreadType.Group ? 'Nhóm chat' : 'Tin nhắn riêng (1-1)';

    const replyMsg = `THÔNG TIN CUỘC TRÒ CHUYỆN:\n` +
      `- Người gửi: ${senderName}\n` +
      `- UID Zalo: ${senderUid}\n` +
      `- Loại hội thoại: ${chatType}\n` +
      `- ID Thread: ${threadId}\n` +
      `- ID Tin nhắn: ${message.data.msgId || 'N/A'}`;

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
