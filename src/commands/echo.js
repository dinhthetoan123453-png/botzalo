module.exports = {
  name: 'echo',
  description: 'Lặp lại nội dung bạn vừa nhập',
  usage: '!echo <nội dung>',
  async execute({ api, message, args, threadId, threadType }) {
    if (!args || args.length === 0) {
      await api.sendMessage(
        {
          msg: 'Vui lòng nhập nội dung muốn lặp lại. Ví dụ: !echo Xin chào Zalo',
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
