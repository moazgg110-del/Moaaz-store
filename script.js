/* =========================================================
   MOAZ STORE — Supabase + واجهة المتجر
   ملاحظة: مفتاح publishable مخصص للواجهة. فعّل RLS وسياسات
   القراءة المناسبة على جدول apps من لوحة Supabase.
   ========================================================= */

const SUPABASE_URL = "https://yhvqevgwudbsyptubaae.supabase.co";
const SUPABASE_KEY = "sb_publishable_pm4EGKlp8jzs6_2AUa5Btw_DyKlZ1vo";
const TABLE_NAME = "apps";

let supabaseClient = null;
let appsData = [];
let currentTab = "all";
let toastTimer = null;

const $ = (id) => document.getElementById(id);

function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem("moaz_store_favs") || "[]");
    return Array.isArray(saved) ? saved.map(String) : [];
  } catch (error) {
    console.warn("تعذر قراءة المفضلة المحفوظة:", error);
    return [];
  }
}

let favorites = readFavorites();

document.addEventListener("DOMContentLoaded", () => {
  $("currentYear").textContent = new Date().getFullYear();
  $("searchInput").addEventListener("input", renderApps);
  $("categorySelect").addEventListener("change", renderApps);
  $("tabAll").addEventListener("click", () => switchTab("all"));
  $("tabFav").addEventListener("click", () => switchTab("fav"));
  $("retryBtn").addEventListener("click", fetchAppsFromSupabase);

  initializeSupabase();
  updateFavCount();
  fetchAppsFromSupabase();
});

function initializeSupabase() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("مكتبة Supabase لم يتم تحميلها.");
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("إعدادات Supabase غير مكتملة.");
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    console.error("فشل تهيئة Supabase:", error);
    supabaseClient = null;
  }
}

async function fetchAppsFromSupabase() {
  const loading = $("loadingState");
  const empty = $("emptyState");
  const grid = $("appsGrid");

  loading.hidden = false;
  empty.hidden = true;
  grid.innerHTML = "";
  $("retryBtn").hidden = true;

  if (!supabaseClient) {
    showLoadError("تعذر تشغيل مكتبة الاتصال بقاعدة البيانات. تأكد من اتصال الإنترنت ثم أعد تحميل الصفحة.");
    return;
  }

  try {
    // نجرب الترتيب أولاً، ثم نعيد المحاولة دون created_at إذا لم يكن العمود موجوداً.
    let result = await supabaseClient
      .from(TABLE_NAME)
      .select("id, title, desc, icon, category, link, created_at")
      .order("created_at", { ascending: false });

    if (result.error) {
      console.warn("الاستعلام المرتب لم ينجح، تتم تجربة قراءة الأعمدة الأساسية:", result.error.message);
      result = await supabaseClient
        .from(TABLE_NAME)
        .select("id, title, desc, icon, category, link");
    }

    if (result.error) throw result.error;

    appsData = Array.isArray(result.data) ? result.data : [];
    $("totalAppsCount").textContent = String(appsData.length);
    loading.hidden = true;
    renderApps();
  } catch (error) {
    console.error("Supabase fetch error:", error);
    showLoadError(getReadableSupabaseError(error));
  }
}

function getReadableSupabaseError(error) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "فشل الاتصال بالإنترنت أو بخادم Supabase. تحقق من الاتصال وحاول مرة أخرى.";
  }
  if (message.includes("relation") || message.includes("does not exist") || message.includes("could not find the table")) {
    return "جدول apps غير موجود. أنشئ جدولاً بهذا الاسم في قاعدة بيانات Supabase.";
  }
  if (message.includes("permission") || message.includes("row-level security") || message.includes("rls")) {
    return "الاتصال وصل إلى Supabase، لكن سياسة صلاحيات القراءة تمنع عرض التطبيقات. راجع إعدادات RLS لجدول apps.";
  }
  return "حدث خطأ أثناء تحميل التطبيقات. راجع اسم الجدول والأعمدة وسياسات الوصول في Supabase.";
}

function showLoadError(message) {
  $("loadingState").hidden = true;
  $("emptyState").hidden = false;
  $("emptyTitle").textContent = "تعذر تحميل المتجر";
  $("emptyText").textContent = message;
  $("retryBtn").hidden = false;
}

function getSmartFallbackIcon(category) {
  const cat = String(category || "").toLowerCase();
  if (cat.includes("لعب") || cat.includes("game")) return "fa-gamepad";
  if (cat.includes("أدوا") || cat.includes("tool")) return "fa-screwdriver-wrench";
  if (cat.includes("تسل") || cat.includes("fun")) return "fa-face-smile";
  if (cat.includes("فيديو") || cat.includes("ميديا") || cat.includes("video")) return "fa-circle-play";
  return "fa-mobile-screen-button";
}

function switchTab(tab) {
  currentTab = tab === "fav" ? "fav" : "all";
  $("tabAll").classList.toggle("active", currentTab === "all");
  $("tabFav").classList.toggle("active", currentTab === "fav");
  $("tabAll").setAttribute("aria-pressed", String(currentTab === "all"));
  $("tabFav").setAttribute("aria-pressed", String(currentTab === "fav"));
  renderApps();
}

function updateFavCount() {
  const count = favorites.length;
  $("favCount").textContent = String(count);
  $("favAppsCount").textContent = String(count);
}

function toggleFavorite(id) {
  const key = String(id);
  favorites = favorites.includes(key)
    ? favorites.filter((favoriteId) => favoriteId !== key)
    : [...favorites, key];

  try {
    localStorage.setItem("moaz_store_favs", JSON.stringify(favorites));
  } catch (error) {
    console.warn("تعذر حفظ المفضلة على هذا الجهاز:", error);
    showToast("تعذر حفظ المفضلة على الجهاز");
  }

  updateFavCount();
  renderApps();
}

async function shareApp(title, link) {
  const safeTitle = String(title || "تطبيق من معاذ ستور");
  const safeLink = safeHttpUrl(link);

  if (!safeLink) {
    showToast("رابط المشاركة غير صالح");
    return;
  }

  const shareData = {
    title: safeTitle,
    text: `جرب ${safeTitle} من متجر معاذ ستور!`,
    url: safeLink
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(safeLink);
      showToast("تم نسخ رابط التطبيق!");
    } else {
      fallbackCopy(safeLink);
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.warn("Share error:", error);
      fallbackCopy(safeLink);
    }
  }
}

function fallbackCopy(text) {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();

  try {
    const copied = document.execCommand("copy");
    showToast(copied ? "تم نسخ الرابط!" : "تعذر النسخ تلقائياً");
  } catch (error) {
    showToast("تعذر نسخ الرابط على هذا المتصفح");
  } finally {
    field.remove();
  }
}

function safeHttpUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value), window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function createTextElement(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value == null ? "" : String(value);
  return element;
}

function renderApps() {
  const grid = $("appsGrid");
  const empty = $("emptyState");
  const searchQuery = $("searchInput").value.trim().toLocaleLowerCase("ar");
  const selectedCategory = $("categorySelect").value;

  grid.replaceChildren();

  const filteredApps = appsData.filter((app) => {
    const title = String(app.title || "").toLocaleLowerCase("ar");
    const description = String(app.desc || "").toLocaleLowerCase("ar");
    const category = String(app.category || "");
    const matchesSearch = !searchQuery || title.includes(searchQuery) ||
      description.includes(searchQuery) || category.toLocaleLowerCase("ar").includes(searchQuery);
    const matchesTab = currentTab === "all" || favorites.includes(String(app.id));
    const matchesCategory = selectedCategory === "all" || category === selectedCategory;
    return matchesSearch && matchesTab && matchesCategory;
  });

  if (filteredApps.length === 0) {
    empty.hidden = false;
    $("retryBtn").hidden = true;
    if (currentTab === "fav") {
      $("emptyTitle").textContent = "المفضلة فارغة";
      $("emptyText").textContent = "اضغط على علامة القلب في أي تطبيق لإضافته إلى المفضلة.";
    } else if (appsData.length === 0) {
      $("emptyTitle").textContent = "المتجر فارغ حالياً";
      $("emptyText").textContent = "ستظهر التطبيقات هنا بمجرد إضافتها إلى جدول apps.";
    } else {
      $("emptyTitle").textContent = "لم نعثر على نتائج";
      $("emptyText").textContent = "جرّب تغيير كلمة البحث أو اختيار تصنيف آخر.";
    }
    return;
  }

  empty.hidden = true;
  const fragment = document.createDocumentFragment();
  filteredApps.forEach((app) => fragment.appendChild(createAppCard(app)));
  grid.appendChild(fragment);
}

function createAppCard(app) {
  const id = String(app.id ?? "");
  const title = String(app.title || "تطبيق بدون عنوان");
  const description = String(app.desc || "اكتشف التطبيق الآن");
  const category = String(app.category || "متنوع");
  const iconUrl = safeHttpUrl(app.icon);
  const downloadUrl = safeHttpUrl(app.link);
  const isFavorite = favorites.includes(id);

  const card = document.createElement("article");
  card.className = "app-card";

  const top = document.createElement("div");
  top.className = "app-header";

  const iconWrap = document.createElement("div");
  iconWrap.className = "app-icon-wrapper";
  const fallback = document.createElement("i");
  fallback.className = `fa-solid ${getSmartFallbackIcon(category)} fallback-icon`;

  if (iconUrl) {
    const image = document.createElement("img");
    image.className = "app-icon";
    image.src = iconUrl;
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      image.remove();
      iconWrap.appendChild(fallback);
    }, { once: true });
    iconWrap.appendChild(image);
  } else {
    iconWrap.appendChild(fallback);
  }

  const info = document.createElement("div");
  info.className = "app-info";
  info.appendChild(createTextElement("h3", "app-title", title));
  info.appendChild(createTextElement("p", "app-desc", description));
  info.appendChild(createTextElement("span", "app-badge", category));

  top.append(iconWrap, info);
  card.appendChild(top);

  const actions = document.createElement("div");
  actions.className = "app-actions";

  const download = document.createElement("a");
  download.className = "btn-download";
  download.href = downloadUrl || "#";
  download.target = "_blank";
  download.rel = "noopener noreferrer";
  download.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i><span>تحميل التطبيق</span>';
  if (!downloadUrl) {
    download.classList.add("is-disabled");
    download.setAttribute("aria-disabled", "true");
    download.addEventListener("click", (event) => event.preventDefault());
  }

  const favoriteButton = document.createElement("button");
  favoriteButton.type = "button";
  favoriteButton.className = `btn-icon btn-fav${isFavorite ? " active" : ""}`;
  favoriteButton.title = isFavorite ? "إزالة من المفضلة" : "أضف إلى المفضلة";
  favoriteButton.setAttribute("aria-label", favoriteButton.title);
  favoriteButton.innerHTML = `<i class="${isFavorite ? "fa-solid" : "fa-regular"} fa-heart" aria-hidden="true"></i>`;
  favoriteButton.addEventListener("click", () => toggleFavorite(id));

  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.className = "btn-icon";
  shareButton.title = "مشاركة التطبيق";
  shareButton.setAttribute("aria-label", "مشاركة التطبيق");
  shareButton.innerHTML = '<i class="fa-solid fa-share-nodes" aria-hidden="true"></i>';
  shareButton.addEventListener("click", () => shareApp(title, downloadUrl));

  actions.append(download, favoriteButton, shareButton);
  card.appendChild(actions);
  return card;
}
