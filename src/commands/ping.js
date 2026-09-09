const startTime = Date.now();

module.exports = {
  name: 'ping',
  description: 'Kiểm tra trạng thái bot và thời gian phản hồi',
  usage: '!ping',
  async execute({ api, message, threadId, threadType }) {
    const latency = Date.now() - (message.data.ts ? parseInt(message.data.ts, 10) : Date.now());
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    const replyMsg = `🏓 Pong!\n` +
      `⏱️ Độ trễ: ${Math.abs(latency)}ms\n` +
      `⏳ Thời gian chạy: ${hours}h ${minutes}m ${seconds}s\n` +
      `🤖 Bot tài khoản cá nhân đang online!`;

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
