const logger = require('./logger');

/**
 * Quản lý lịch sử tin nhắn gần nhất theo từng cuộc hội thoại (threadId)
 * Dùng để cung cấp ngữ cảnh 8 tin nhắn gần nhất cho AI tối ưu câu trả lời.
 */
class ChatHistory {
  constructor(maxPerThread = 30, maxThreads = 500) {
    this.maxPerThread = maxPerThread;
    this.maxThreads = maxThreads;
    /** @type {Map<string, Array<{sender: string, content: string, isSelf: boolean, timestamp: number}>>} */
    this.history = new Map();
  }

  /**
   * Thêm một tin nhắn vào lịch sử của threadId
   * @param {string} threadId 
   * @param {{sender: string, content: string, isSelf?: boolean, timestamp?: number}} msg 
   */
  addMessage(threadId, { sender, content, isSelf = false, timestamp = Date.now() }) {
    if (!threadId || !content || typeof content !== 'string') return;
    const cleanContent = content.trim();
    if (!cleanContent) return;

    // Giới hạn số lượng thread để tránh rò rỉ bộ nhớ
    if (!this.history.has(threadId) && this.history.size >= this.maxThreads) {
      const firstKey = this.history.keys().next().value;
      if (firstKey) this.history.delete(firstKey);
    }

    if (!this.history.has(threadId)) {
      this.history.set(threadId, []);
    }

    const list = this.history.get(threadId);

    // Tránh lưu trùng lặp tin nhắn giống hệt nhau trong vòng 2.5 giây
    const isDuplicate = list.some(
      m => m.content === cleanContent &&
           m.sender === sender &&
           Math.abs(timestamp - m.timestamp) < 2500
    );
    if (isDuplicate) return;

    list.push({
      sender: sender || (isSelf ? 'Bot (Bạn)' : 'Người dùng'),
      content: cleanContent,
      isSelf: !!isSelf,
      timestamp: Number(timestamp) || Date.now(),
    });

    // Luôn đảm bảo danh sách tin nhắn được sắp xếp đúng thứ tự thời gian tăng dần
    list.sort((a, b) => a.timestamp - b.timestamp);

    // Giữ tối đa maxPerThread tin nhắn gần nhất
    if (list.length > this.maxPerThread) {
      list.splice(0, list.length - this.maxPerThread);
    }
  }

  /**
   * Lấy danh sách tin nhắn gần nhất trong bộ nhớ
   * @param {string} threadId 
   * @param {number} limit 
   * @returns {Array<{sender: string, content: string, isSelf: boolean, timestamp: number}>}
   */
  getRecentMessages(threadId, limit = 8) {
    const list = this.history.get(threadId) || [];
    return list.slice(-limit);
  }

  /**
   * Lấy lịch sử tin nhắn, có hỗ trợ gọi API Zalo nếu trong nhóm và bộ nhớ chưa đủ
   * @param {import('zca-js').API} api 
   * @param {string} threadId 
   * @param {boolean} isGroup 
   * @param {number} limit 
   * @returns {Promise<Array<{sender: string, content: string, isSelf: boolean, timestamp: number}>>}
   */
  async getHistoryWithFallback(api, threadId, isGroup, limit = 8) {
    let localMessages = this.getRecentMessages(threadId, limit);

    // Nếu trong nhóm và chưa đủ số tin nhắn trong bộ nhớ cache, thử lấy từ lịch sử Zalo Group
    if (isGroup && localMessages.length < limit && api && typeof api.getGroupChatHistory === 'function') {
      try {
        const historyRes = await api.getGroupChatHistory(threadId, limit * 2);
        if (historyRes && Array.isArray(historyRes.groupMsgs)) {
          // Sắp xếp groupMsgs theo thứ tự thời gian tăng dần trước khi nạp vào cache
          const sortedMsgs = [...historyRes.groupMsgs].sort((a, b) => {
            const tsA = Number(a?.data?.ts || 0);
            const tsB = Number(b?.data?.ts || 0);
            return tsA - tsB;
          });

          for (const item of sortedMsgs) {
            const data = item.data;
            if (data && typeof data.content === 'string' && data.content.trim()) {
              this.addMessage(threadId, {
                sender: data.dName || (item.isSelf ? 'Bot (Bạn)' : 'Thành viên'),
                content: data.content,
                isSelf: item.isSelf,
                timestamp: Number(data.ts) || Date.now(),
              });
            }
          }
          localMessages = this.getRecentMessages(threadId, limit);
        }
      } catch (err) {
        logger.warn(`Không thể lấy lịch sử nhóm qua API (${err.message}). Sử dụng cache cục bộ.`);
      }
    }

    return localMessages;
  }

  /**
   * Định dạng danh sách tin nhắn thành chuỗi văn bản ngữ cảnh dễ đọc cho AI
   * @param {Array<{sender: string, content: string, isSelf: boolean}>} messages 
   * @returns {string}
   */
  formatForPrompt(messages) {
    if (!messages || messages.length === 0) return '';
    return messages
      .map((m, idx) => {
        const senderName = m.isSelf ? 'Bot (Bạn)' : m.sender;
        return `${idx + 1}. [${senderName}]: ${m.content}`;
      })
      .join('\n');
  }

  /**
   * Xóa lịch sử của một cuộc hội thoại
   * @param {string} threadId 
   */
  clearThread(threadId) {
    this.history.delete(threadId);
  }
}

// Singleton instance dùng chung toàn bộ ứng dụng
const chatHistory = new ChatHistory();

module.exports = chatHistory;
