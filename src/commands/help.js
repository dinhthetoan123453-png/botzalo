const config = require('../config');

module.exports = {
  name: 'help',
  description: 'Hiển thị danh sách tất cả các lệnh của bot',
  usage: '!help',
  async execute({ api, message, threadId, threadType }) {
    const { commands } = require('./index');

    let helpText = `DANH SÁCH LỆNH ZALO BOT:\n`;
    helpText += `(Tiền tố lệnh: ${config.prefix})\n\n`;

    for (const [name, cmd] of commands.entries()) {
      helpText += `+ ${cmd.usage || config.prefix + name}\n  > ${cmd.description || 'Không có mô tả'}\n\n`;
    }

    helpText += `Mẹo: Gõ đúng cú pháp để bot thực thi lệnh.`;

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
