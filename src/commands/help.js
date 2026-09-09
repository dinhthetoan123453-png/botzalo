const config = require('../config');

module.exports = {
  name: 'help',
  description: 'Hien thi danh sach tat ca cac lenh cua bot',
  usage: '!help',
  async execute({ api, message, threadId, threadType }) {
    const { commands } = require('./index');

    let helpText = `DANH SACH LENH ZALO BOT:\n`;
    helpText += `(Tien to lenh: ${config.prefix})\n\n`;

    for (const [name, cmd] of commands.entries()) {
      helpText += `+ ${cmd.usage || config.prefix + name}\n  > ${cmd.description || 'Khong co mo ta'}\n\n`;
    }

    helpText += `Meo: Go dung cu phap de bot thuc thi lenh.`;

    await api.sendMessage(
      {
        msg: helpText,
        quote: message.data,
      },
      threadId,
      threadType
    );
  },
};
