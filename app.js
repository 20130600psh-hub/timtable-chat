(() => {
  const config = window.CHAT_CONFIG || {};
  const hasConfig =
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !config.supabaseUrl.includes("여기에_") &&
    !config.supabaseAnonKey.includes("여기에_");

  const $ = (id) => document.getElementById(id);
  const nicknameInput = $("nicknameInput");
  const roomInput = $("roomInput");
  const joinButton = $("joinButton");
  const roomTitle = $("roomTitle");
  const messageList = $("messageList");
  const messageCount = $("messageCount");
  const messageForm = $("messageForm");
  const messageInput = $("messageInput");
  const sendButton = messageForm.querySelector("button");
  const clearButton = $("clearButton");
  const notice = $("notice");
  const connectionStatus = $("connectionStatus");

  let supabaseClient = null;
  let channel = null;
  let currentRoom = "";
  let currentNickname = "";
  let messages = [];

  nicknameInput.value = localStorage.getItem("chat_nickname") || "";

  function showNotice(text = "") {
    notice.textContent = text;
  }

  function setStatus(text, online = false) {
    connectionStatus.textContent = text;
    connectionStatus.className = `status ${online ? "online" : "offline"}`;
  }

  function renderMessages() {
    messageList.replaceChildren();
    messageCount.textContent = `메시지 ${messages.length}개`;

    if (!messages.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const strong = document.createElement("strong");
      strong.textContent = "아직 메시지가 없습니다.";
      const span = document.createElement("span");
      span.textContent = "첫 번째 메시지를 보내 보세요.";
      empty.append(strong, span);
      messageList.append(empty);
      return;
    }

    messages.forEach((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = `message ${item.nickname === currentNickname ? "mine" : ""}`;

      const meta = document.createElement("div");
      meta.className = "message-meta";
      const name = document.createElement("strong");
      name.textContent = item.nickname;
      const time = document.createElement("span");
      time.textContent = new Date(item.created_at).toLocaleTimeString("ko-KR", {
        hour: "2-digit", minute: "2-digit"
      });
      meta.append(name, time);

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = item.message;

      wrapper.append(meta, bubble);
      messageList.append(wrapper);
    });
    messageList.scrollTop = messageList.scrollHeight;
  }

  async function loadMessages() {
    const { data, error } = await supabaseClient
      .from("chat_messages")
      .select("id, room_name, nickname, message, created_at")
      .eq("room_name", currentRoom)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;
    messages = data || [];
    renderMessages();
  }

  async function joinRoom() {
    currentNickname = nicknameInput.value.trim();
    currentRoom = roomInput.value.trim();

    if (!currentNickname || !currentRoom) {
      showNotice("닉네임과 채팅방 이름을 모두 입력해 주세요.");
      return;
    }
    if (!hasConfig) {
      showNotice("먼저 config.js에 Supabase URL과 anon public key를 입력해 주세요.");
      return;
    }

    localStorage.setItem("chat_nickname", currentNickname);
    showNotice("");
    joinButton.disabled = true;

    try {
      if (channel) await supabaseClient.removeChannel(channel);
      channel = null;
      messages = [];
      roomTitle.textContent = currentRoom;
      renderMessages();

      await loadMessages();

      channel = supabaseClient
        .channel(`room-${currentRoom}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `room_name=eq.${currentRoom}`
          },
          (payload) => {
            if (!messages.some((item) => item.id === payload.new.id)) {
              messages.push(payload.new);
              renderMessages();
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setStatus("실시간 연결됨", true);
          } else if (status === "CHANNEL_ERROR") {
            setStatus("연결 오류");
            showNotice("실시간 연결에 실패했습니다. Supabase Realtime 설정을 확인해 주세요.");
          }
        });

      messageInput.disabled = false;
      sendButton.disabled = false;
      messageInput.focus();
    } catch (error) {
      console.error(error);
      setStatus("연결 실패");
      showNotice(`연결에 실패했습니다: ${error.message}`);
    } finally {
      joinButton.disabled = false;
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !currentRoom || !currentNickname) return;

    sendButton.disabled = true;
    const { error } = await supabaseClient.from("chat_messages").insert({
      room_name: currentRoom,
      nickname: currentNickname,
      message: text
    });

    if (error) {
      console.error(error);
      showNotice(`메시지 전송 실패: ${error.message}`);
    } else {
      messageInput.value = "";
      showNotice("");
    }
    sendButton.disabled = false;
    messageInput.focus();
  }

  clearButton.addEventListener("click", () => {
    messageInput.value = "";
    messageInput.focus();
  });
  joinButton.addEventListener("click", joinRoom);
  messageForm.addEventListener("submit", sendMessage);

  if (!hasConfig) {
    setStatus("설정 필요");
    showNotice("Supabase 설정 후 채팅방에 입장할 수 있습니다.");
  }
})();
