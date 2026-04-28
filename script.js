const form = document.querySelector("#loginForm");
const formTitle = document.querySelector("#formTitle");
const formSubtitle = document.querySelector("#formSubtitle");
const fullName = document.querySelector("#fullName");
const email = document.querySelector("#email");
const password = document.querySelector("#password");
const remember = document.querySelector("#remember");
const toggle = document.querySelector(".password-toggle");
const message = document.querySelector("#message");
const submitButton = document.querySelector("#submitButton");
const submitText = document.querySelector("#submitText");
const emailMessage = document.querySelector("#emailMessage");
const passwordMessage = document.querySelector("#passwordMessage");
const nameMessage = document.querySelector("#nameMessage");
const strength = document.querySelector(".strength");
const strengthText = document.querySelector("#strengthText");
const toast = document.querySelector("#toast");
const welcomeText = document.querySelector("#welcomeText");
const loginCard = document.querySelector("#loginCard");
const successCard = document.querySelector("#successCard");
const successTitle = document.querySelector("#successTitle");
const successText = document.querySelector("#successText");
const logoutButton = document.querySelector("#logoutButton");
const forgotButton = document.querySelector("#forgotButton");
const createButton = document.querySelector("#createButton");
const modeQuestion = document.querySelector("#modeQuestion");
const nameField = document.querySelector("#nameField");
const configNotice = document.querySelector("#configNotice");
const metrics = document.querySelectorAll(".metric");
const socialButtons = document.querySelectorAll(".social");

const config = window.supabaseConfig || {};
const supabaseKey = config.publishableKey || config.anonKey || "";
const hasSupabaseKeys = Boolean(
  config.url &&
  supabaseKey &&
  !config.url.includes("PEGA_AQUI") &&
  !supabaseKey.includes("PEGA_AQUI")
);
const supabaseClient = hasSupabaseKeys && window.supabase ? supabase.createClient(config.url, supabaseKey) : null;

let mode = document.body.dataset.authMode === "register" ? "register" : "login";

if (!hasSupabaseKeys || !window.supabase) {
  configNotice.hidden = false;
  configNotice.textContent = !window.supabase
    ? "No se pudo cargar la libreria de Supabase. Revisa tu conexion a internet."
    : "Conecta tus claves de Supabase en supabase-config.js para registrar usuarios reales.";
}

const savedEmail = localStorage.getItem("novadataEmail");

if (savedEmail) {
  email.value = savedEmail;
  remember.checked = true;
  validateEmail();
}

toggle.addEventListener("click", () => {
  const isHidden = password.type === "password";
  password.type = isHidden ? "text" : "password";
  toggle.setAttribute("aria-label", isHidden ? "Ocultar contrasena" : "Mostrar contrasena");
  toggle.setAttribute("title", isHidden ? "Ocultar contrasena" : "Mostrar contrasena");
  password.focus();
});

fullName.addEventListener("input", validateName);

email.addEventListener("input", () => {
  validateEmail();
  updateWelcome();
});

password.addEventListener("input", () => {
  validatePassword();
  updateStrength();
});

remember.addEventListener("change", () => {
  showToast(remember.checked ? "Guardaremos tu correo en este navegador." : "No guardaremos tu correo.");
});

metrics.forEach((metric) => {
  metric.addEventListener("click", () => {
    metrics.forEach((item) => item.classList.remove("is-active"));
    metric.classList.add("is-active");
    welcomeText.textContent = metric.dataset.tip;
  });
});

socialButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (!hasSupabaseKeys) {
      showToast(`Conecta Supabase para usar ${button.dataset.provider}.`);
      return;
    }

    const provider = button.dataset.provider === "Microsoft" ? "azure" : button.dataset.provider.toLowerCase();
    const { error } = await supabaseClient.auth.signInWithOAuth({ provider });

    if (error) {
      showToast(error.message);
    }
  });
});

forgotButton.addEventListener("click", async () => {
  const value = email.value.trim();

  if (!value || !isValidEmail(value)) {
    showToast("Escribe tu correo para recuperar la contrasena.");
    email.focus();
    return;
  }

  if (!hasSupabaseKeys) {
    showToast(`Recuperacion simulada para ${value}. Conecta Supabase para enviarla real.`);
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(value);

  if (error) {
    showToast(error.message);
    return;
  }

  showToast(`Enviamos las instrucciones a ${value}.`);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const validName = mode === "register" ? validateName() : true;
  const validEmail = validateEmail();
  const validPassword = validatePassword();
  updateStrength();

  if (!validName || !validEmail || !validPassword) {
    setMessage("Revisa los campos marcados antes de continuar.", true);
    return;
  }

  if (!hasSupabaseKeys) {
    setMessage("Falta completar o cargar la conexion de Supabase.", true);
    showToast("Pega tu URL y anon key de Supabase para guardar usuarios reales.");
    return;
  }

  setLoading(true);
  setMessage(mode === "register" ? "Creando tu cuenta..." : "Verificando tus datos...", false);

  const response = mode === "register" ? await registerUser() : await loginUser();

  setLoading(false);

  if (response.error) {
    setMessage(getFriendlyError(response.error.message), true);
    return;
  }

  if (remember.checked) {
    localStorage.setItem("novadataEmail", email.value.trim());
  } else {
    localStorage.removeItem("novadataEmail");
  }

  if (mode === "register" && !response.data.session) {
    setMessage("Cuenta creada. Revisa tu correo para confirmar el registro.", false);
    showToast("Supabase registro el usuario correctamente.");
    return;
  }

  showSuccess(mode === "register");
});

logoutButton.addEventListener("click", async () => {
  if (hasSupabaseKeys) {
    await supabaseClient.auth.signOut();
  }

  successCard.hidden = true;
  loginCard.hidden = false;
  password.value = "";
  updateStrength();
  setMessage("Cerraste la sesion.", false);
  password.focus();
});

setMode(mode);

async function registerUser() {
  return supabaseClient.auth.signUp({
    email: email.value.trim(),
    password: password.value,
    options: {
      data: {
        full_name: fullName.value.trim()
      }
    }
  });
}

async function loginUser() {
  return supabaseClient.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value
  });
}

function setMode(nextMode) {
  mode = nextMode;
  const isRegister = mode === "register";

  nameField.hidden = !isRegister;
  fullName.required = isRegister;
  formTitle.textContent = isRegister ? "Crear cuenta" : "Iniciar sesion";
  formSubtitle.textContent = isRegister
    ? "Registra un usuario nuevo en Supabase con correo y contrasena."
    : "Ingresa tus credenciales para continuar con tu cuenta.";
  submitText.textContent = isRegister ? "Crear usuario" : "Entrar al panel";
  modeQuestion.textContent = isRegister ? "Ya tienes cuenta?" : "No tienes cuenta?";
  setMessage("", false);
}

function validateName() {
  const value = fullName.value.trim();

  if (mode !== "register") {
    return true;
  }

  if (value.length < 2) {
    setFieldState(fullName, nameMessage, "Escribe tu nombre.", false);
    return false;
  }

  setFieldState(fullName, nameMessage, "Nombre listo.", true);
  return true;
}

function validateEmail() {
  const value = email.value.trim();

  if (!value) {
    setFieldState(email, emailMessage, "Escribe tu correo electronico.", false);
    return false;
  }

  if (!isValidEmail(value)) {
    setFieldState(email, emailMessage, "Usa un correo valido, por ejemplo nombre@correo.com.", false);
    return false;
  }

  setFieldState(email, emailMessage, "Correo listo.", true);
  return true;
}

function validatePassword() {
  const value = password.value;

  if (!value) {
    setFieldState(password, passwordMessage, "Escribe tu contrasena.", false);
    return false;
  }

  if (value.length < 6) {
    setFieldState(password, passwordMessage, "Debe tener al menos 6 caracteres.", false);
    return false;
  }

  setFieldState(password, passwordMessage, "Contrasena lista.", true);
  return true;
}

function updateStrength() {
  const value = password.value;
  let level = 0;

  if (value.length >= 6) level += 1;
  if (/[A-Z]/.test(value) || /\d/.test(value)) level += 1;
  if (/[^A-Za-z0-9]/.test(value) && value.length >= 10) level += 1;

  strength.dataset.level = String(level);

  if (level === 0) strengthText.textContent = "Escribe una contrasena";
  if (level === 1) strengthText.textContent = "Seguridad basica";
  if (level === 2) strengthText.textContent = "Buena seguridad";
  if (level === 3) strengthText.textContent = "Seguridad alta";
}

function setFieldState(input, helper, text, isValid) {
  input.classList.toggle("is-valid", isValid);
  input.classList.toggle("is-invalid", !isValid);
  helper.textContent = text;
  helper.style.color = isValid ? "var(--teal)" : "var(--danger)";
}

function setMessage(text, isError) {
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

function setLoading(isLoading) {
  submitButton.classList.toggle("is-loading", isLoading);
  submitButton.disabled = isLoading;
}

function updateWelcome() {
  const value = email.value.trim();
  const name = value.includes("@") ? value.split("@")[0] : "";

  if (name.length > 2) {
    welcomeText.textContent = `Hola, ${name}. Tu acceso personalizado esta casi listo.`;
  }
}

function showSuccess(wasRegister) {
  const name = email.value.trim().split("@")[0];

  loginCard.hidden = true;
  successCard.hidden = false;
  successTitle.textContent = `Hola, ${capitalize(name)}`;
  successText.textContent = wasRegister
    ? "Tu usuario fue creado en Supabase y la sesion quedo iniciada."
    : "Tu sesion fue verificada correctamente con Supabase.";
  showToast(wasRegister ? "Usuario registrado correctamente." : "Sesion iniciada correctamente.");
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("is-visible");

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2800);
}

function getFriendlyError(text) {
  const lower = text.toLowerCase();

  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "Ese correo ya esta registrado. Prueba iniciar sesion.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Correo o contrasena incorrectos.";
  }

  if (lower.includes("email not confirmed")) {
    return "Confirma tu correo antes de iniciar sesion.";
  }

  return text;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function capitalize(value) {
  if (!value) return "de nuevo";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
