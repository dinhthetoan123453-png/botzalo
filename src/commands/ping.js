const startTime = Date.now();

module.exports = {
  name: 'ping',
  description: 'Kiem tra trang thai bot va thoi gian phan hoi',
  usage: '!ping',
  async execute({ api, message, threadId, threadType }) {
    const latency = Date.now() - (message.data.ts ? parseInt(message.data.ts, 10) : Date.now());
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    const replyMsg = `Pong!\n` +
      `- Do tre: ${Math.abs(latency)}ms\n` +
      `- Thoi gian hoat dong: ${hours}h ${minutes}m ${seconds}s\n` +
      `- Trang thai: Online`;

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
