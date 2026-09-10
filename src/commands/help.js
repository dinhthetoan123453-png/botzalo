const config = require('../config');
const { safeSendMessage } = require('../utils/messageHelper');

module.exports = {
  name: 'help',
  description: 'Hiển thị danh sách tất cả các lệnh của bot',
  usage: '!help',
  async execute({ api, message, threadId, threadType }) {
    const { commands } = require('./index');

    let helpText = `DANH SÁCH LỆNH ZALO BOT:\n`;
    helpText += `(Tiền tố lệnh: ${config.prefix})\n\n`;

    const uniqueCommands = Array.from(new Set(commands.values()));
    for (const cmd of uniqueCommands) {
      const aliasStr = Array.isArray(cmd.aliases) && cmd.aliases.length > 0 ? ` (hoặc !${cmd.aliases.join(', !')})` : '';
      helpText += `+ ${cmd.usage || config.prefix + cmd.name}${aliasStr}\n  > ${cmd.description || 'Không có mô tả'}\n\n`;
    }

    helpText += `Mẹo: Bạn có thể dùng cả dấu ! hoặc dấu / ở đầu mỗi lệnh.`;

    await safeSendMessage(
      api,
      {
        msg: helpText,
        quote: message.data,
      },
      threadId,
      threadType
    );
  },
};
