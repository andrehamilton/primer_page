const feed = document.querySelector("#feed");
const postForm = document.querySelector("#postForm");
const postText = document.querySelector("#postText");
const postCounter = document.querySelector("#postCounter");
const searchInput = document.querySelector("#searchInput");
const logoutButton = document.querySelector("#logoutButton");
const sidePostButton = document.querySelector("#sidePostButton");
const floatingPostButton = document.querySelector("#floatingPostButton");
const templateButtons = document.querySelectorAll("[data-template]");
const trendButtons = document.querySelectorAll("[data-search]");
const toast = document.querySelector("#toast");

const config = window.supabaseConfig || {};
const supabaseKey = config.publishableKey || config.anonKey || "";
const hasSupabaseKeys = Boolean(config.url && supabaseKey);
const supabaseClient = hasSupabaseKeys && window.supabase
  ? supabase.createClient(config.url, supabaseKey)
  : null;

const likedPosts = new Set(loadLikedPosts());
let posts = [];
let usingSupabase = Boolean(supabaseClient);

init();

postText.addEventListener("input", updateCounter);

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createPost(postText.value);
});

sidePostButton.addEventListener("click", focusComposer);
floatingPostButton.addEventListener("click", focusComposer);

templateButtons.forEach((button) => {
  button.addEventListener("click", () => {
    postText.value = button.dataset.template;
    updateCounter();
    focusComposer();
  });
});

trendButtons.forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.search;
    renderFeed(searchInput.value);
  });
});

searchInput.addEventListener("input", () => {
  renderFeed(searchInput.value);
});

feed.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const post = button.closest(".post");
  if (!post) return;

  if (button.dataset.action === "like") {
    await toggleLike(post.dataset.postId);
  }

  if (button.dataset.action === "reply") {
    const input = post.querySelector(".reply-form input");
    input.focus();
  }

  if (button.dataset.action === "share") {
    showToast("Enlace anonimo listo para compartir.");
  }
});

feed.addEventListener("submit", async (event) => {
  const form = event.target.closest(".reply-form");
  if (!form) return;

  event.preventDefault();
  const input = form.querySelector("input");
  await addReply(form.dataset.postId, input.value);
  input.value = "";
});

logoutButton.addEventListener("click", async () => {
  localStorage.removeItem("retrodataCurrentUser");

  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  window.location.href = "index.html";
});

async function init() {
  updateCounter();

  if (!supabaseClient) {
    usingSupabase = false;
    posts = loadLocalPosts();
    seedLocalPosts();
    renderFeed();
    showToast("Supabase no cargo. Usando modo local.");
    return;
  }

  await loadSupabasePosts();
}

function focusComposer() {
  postText.focus();
  postText.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function createPost(text) {
  const content = text.trim();

  if (!content) {
    showToast("Escribe algo para publicar.");
    focusComposer();
    return;
  }

  if (usingSupabase) {
    const { error } = await supabaseClient
      .from("anonymous_posts")
      .insert({ content });

    if (error) {
      handleSupabaseError(error);
      return;
    }

    postText.value = "";
    updateCounter();
    await loadSupabasePosts();
    showToast("Publicado anonimamente para todos.");
    return;
  }

  posts.unshift({
    id: createId(),
    content,
    created_at: new Date().toISOString(),
    likes: 0,
    replies: []
  });

  saveLocalPosts();
  postText.value = "";
  updateCounter();
  renderFeed(searchInput.value);
  showToast("Publicado de forma anonima.");
}

async function toggleLike(postId) {
  const post = posts.find((item) => String(item.id) === String(postId));
  if (!post) return;

  const liked = likedPosts.has(String(postId));
  const nextLikes = Math.max(0, Number(post.likes || 0) + (liked ? -1 : 1));

  if (usingSupabase) {
    const { error } = await supabaseClient
      .from("anonymous_posts")
      .update({ likes: nextLikes })
      .eq("id", postId);

    if (error) {
      handleSupabaseError(error);
      return;
    }
  }

  if (liked) {
    likedPosts.delete(String(postId));
  } else {
    likedPosts.add(String(postId));
  }

  saveLikedPosts();
  post.likes = nextLikes;
  renderFeed(searchInput.value);

  if (!usingSupabase) {
    saveLocalPosts();
  }
}

async function addReply(postId, text) {
  const content = text.trim();

  if (!content) {
    showToast("Escribe un comentario anonimo.");
    return;
  }

  if (usingSupabase) {
    const { error } = await supabaseClient
      .from("anonymous_replies")
      .insert({
        post_id: postId,
        content
      });

    if (error) {
      handleSupabaseError(error);
      return;
    }

    await loadSupabasePosts();
    return;
  }

  posts = posts.map((post) => {
    if (String(post.id) !== String(postId)) return post;

    return {
      ...post,
      replies: [
        ...post.replies,
        {
          id: createId(),
          content,
          created_at: new Date().toISOString()
        }
      ]
    };
  });

  saveLocalPosts();
  renderFeed(searchInput.value);
}

async function loadSupabasePosts() {
  const { data, error } = await supabaseClient
    .from("anonymous_posts")
    .select("id, content, likes, created_at, anonymous_replies(id, content, created_at)")
    .order("created_at", { ascending: false });

  if (error) {
    handleSupabaseError(error);
    usingSupabase = false;
    posts = loadLocalPosts();
    seedLocalPosts();
    renderFeed();
    return;
  }

  posts = (data || []).map((post) => ({
    id: post.id,
    content: post.content,
    likes: post.likes || 0,
    created_at: post.created_at,
    replies: (post.anonymous_replies || [])
      .map((reply) => ({
        id: reply.id,
        content: reply.content,
        created_at: reply.created_at
      }))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }));

  renderFeed(searchInput.value);
}

function renderFeed(query = "") {
  const search = query.trim().toLowerCase();
  const visiblePosts = search
    ? posts.filter((post) => {
        const replies = post.replies.map((reply) => reply.content).join(" ");
        return `${post.content} ${replies}`.toLowerCase().includes(search);
      })
    : posts;

  feed.replaceChildren();

  if (visiblePosts.length === 0) {
    const empty = document.createElement("article");
    empty.className = "empty-feed";
    empty.textContent = "No hay publicaciones con ese tema.";
    feed.append(empty);
    return;
  }

  visiblePosts.forEach((post) => {
    feed.append(createPostElement(post));
  });
}

function createPostElement(post) {
  const article = document.createElement("article");
  article.className = "post";
  article.dataset.postId = post.id;

  const avatar = document.createElement("div");
  avatar.className = "anon-avatar small";
  avatar.textContent = "?";

  const body = document.createElement("div");
  body.className = "post-body";

  const meta = document.createElement("div");
  meta.className = "post-meta";

  const name = document.createElement("strong");
  name.textContent = "Anonimo";
  const handle = document.createElement("span");
  handle.textContent = `@anonimo - ${formatTime(post.created_at)}`;
  meta.append(name, handle);

  const text = document.createElement("p");
  text.className = "post-text";
  text.textContent = post.content;

  const actions = document.createElement("div");
  actions.className = "post-actions";
  actions.append(
    createAction("Responder", "reply", post.replies.length, false),
    createAction(likedPosts.has(String(post.id)) ? "Te gusta" : "Me gusta", "like", post.likes, likedPosts.has(String(post.id))),
    createAction("Compartir", "share", "", false)
  );

  const replies = document.createElement("div");
  replies.className = "replies";
  post.replies.forEach((reply) => replies.append(createReply(reply)));

  const form = document.createElement("form");
  form.className = "reply-form";
  form.dataset.postId = post.id;

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 180;
  input.placeholder = "Comenta anonimamente";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Responder";
  form.append(input, submit);

  body.append(meta, text, actions, replies, form);
  article.append(avatar, body);
  return article;
}

function createAction(label, action, count, active) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.classList.toggle("is-active", active);
  button.textContent = count === "" ? label : `${label} ${count}`;
  return button;
}

function createReply(reply) {
  const item = document.createElement("div");
  item.className = "reply";

  const meta = document.createElement("strong");
  meta.textContent = `Anonimo - ${formatTime(reply.created_at)}`;

  const content = document.createElement("span");
  content.textContent = reply.content;
  item.append(meta, content);
  return item;
}

function seedLocalPosts() {
  if (posts.length > 0) return;

  posts = [
    {
      id: createId(),
      content: "Pregunta anonima: que opinan de crear una pagina para que todos publiquen sin mostrar su nombre?",
      created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      likes: 18,
      replies: [
        {
          id: createId(),
          content: "Me parece buena idea si mantiene respeto y comentarios cortos.",
          created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString()
        }
      ]
    },
    {
      id: createId(),
      content: "Opinion anonima: una red simple tipo Twitter queda mejor para mensajes rapidos que un muro tipo Facebook.",
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      likes: 31,
      replies: []
    }
  ];

  saveLocalPosts();
}

function handleSupabaseError(error) {
  console.error(error);
  showToast("Faltan las tablas de Supabase o permisos RLS. Revisa supabase-social-schema.sql.");
}

function loadLocalPosts() {
  try {
    const savedPosts = JSON.parse(localStorage.getItem("retrodataAnonymousPosts") || "[]");
    return Array.isArray(savedPosts) ? savedPosts : [];
  } catch {
    return [];
  }
}

function saveLocalPosts() {
  localStorage.setItem("retrodataAnonymousPosts", JSON.stringify(posts));
}

function loadLikedPosts() {
  try {
    const savedLikes = JSON.parse(localStorage.getItem("retrodataLikedAnonymousPosts") || "[]");
    return Array.isArray(savedLikes) ? savedLikes : [];
  } catch {
    return [];
  }
}

function saveLikedPosts() {
  localStorage.setItem("retrodataLikedAnonymousPosts", JSON.stringify([...likedPosts]));
}

function updateCounter() {
  postCounter.textContent = `${postText.value.length}/280`;
}

function createId() {
  return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now() + Math.random());
}

function formatTime(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} d`;
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("is-visible");

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3200);
}
