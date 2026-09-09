module.exports = {
  name: 'echo',
  description: 'Lap lai noi dung ban vua nhap',
  usage: '!echo <noi dung>',
  async execute({ api, message, args, threadId, threadType }) {
    if (!args || args.length === 0) {
      await api.sendMessage(
        {
          msg: 'Vui long nhap noi dung muon lap lai. Vi du: !echo Xin chao Zalo',
          quote: message.data,
        },
        threadId,
        threadType
      );
      return;
    }

    const textToEcho = args.join(' ');
    await api.sendMessage(
      {
        msg: `Echo: ${textToEcho}`,
        quote: message.data,
      },
      threadId,
      threadType
    );
  },
};
