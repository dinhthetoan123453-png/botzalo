const config = require('../config');

module.exports = {
  name: 'help',
  description: 'Hiển thị danh sách tất cả các lệnh của bot',
  usage: '!help',
  async execute({ api, message, threadId, threadType }) {
    // Dynamic require to avoid circular dependencies
    const { commands } = require('./index');

    let helpText = `📜 DANH SÁCH LỆNH ZALO BOT:\n`;
    helpText += `(Tiền tố hiện tại: ${config.prefix})\n\n`;

    for (const [name, cmd] of commands.entries()) {
      helpText += `🔹 ${cmd.usage || config.prefix + name}\n   ➥ ${cmd.description || 'Không có mô tả'}\n\n`;
    }

    helpText += `💡 Mẹo: Bạn có thể thêm lệnh mới trong thư mục src/commands/`;

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
