// Interakcje strony: menu mobilne, stan headera, rok w stopce.
(function () {
  function init() {
    var menuButton = document.querySelector("[data-menu-button]");
    var nav = document.querySelector("[data-nav]");

    if (menuButton && nav) {
      var closeMenu = function () {
        nav.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Otwórz menu");
      };

      menuButton.addEventListener("click", function () {
        var isOpen = nav.classList.toggle("is-open");
        menuButton.setAttribute("aria-expanded", String(isOpen));
        menuButton.setAttribute(
          "aria-label",
          isOpen ? "Zamknij menu" : "Otwórz menu",
        );
      });

      nav.addEventListener("click", function (event) {
        if (event.target.closest("a")) {
          closeMenu();
        }
      });

      // Escape zamyka menu i przywraca fokus na przycisk; klik poza panelem
      // również je zamyka — standardowe zachowanie rozwijanego menu.
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && nav.classList.contains("is-open")) {
          closeMenu();
          menuButton.focus();
        }
      });

      document.addEventListener("click", function (event) {
        if (!nav.classList.contains("is-open")) return;
        if (nav.contains(event.target) || menuButton.contains(event.target)) {
          return;
        }
        closeMenu();
      });
    }

    var header = document.querySelector("[data-header]");
    if (header) {
      var updateHeader = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 8);
      };
      updateHeader();
      window.addEventListener("scroll", updateHeader, { passive: true });
    }

    var year = String(new Date().getFullYear());
    document.querySelectorAll("[data-current-year]").forEach(function (el) {
      el.textContent = year;
    });

    initPrefetch();
    initMapFacades();
    initBookingDeepLinks();
    initCertsCarousel();
    initReviewsCarousel();
  }

  // Karuzela opinii pacjentów na stronie głównej — te same założenia co
  // karuzela certyfikatów (Splide, pętla, autoplay z pauzą na hover/focus,
  // brak animacji przy prefers-reduced-motion), ale prostsza: bez popupu i
  // bez powiększania aktywnego slajdu — to wielokolumnowa karuzela kart z
  // cytatami, która przewija się samodzielnie.
  function initReviewsCarousel() {
    var splideRoot = document.getElementById("opinie-splide");
    if (!splideRoot || typeof Splide === "undefined") return;

    var wrapper = splideRoot.closest(".reviews-carousel");
    var prevBtn = wrapper ? wrapper.querySelector("[data-reviews-prev]") : null;
    var nextBtn = wrapper ? wrapper.querySelector("[data-reviews-next]") : null;

    var reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    var splide = new Splide(splideRoot, {
      type: "loop",
      perPage: 3,
      perMove: 1,
      gap: "22px",
      arrows: false,
      pagination: false,
      drag: true,
      speed: 500,
      easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      autoplay: !reduceMotion,
      interval: 5000,
      pauseOnHover: true,
      pauseOnFocus: true,
      breakpoints: {
        980: { perPage: 2 },
        620: { perPage: 1 },
      },
    });

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        splide.go("<");
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        splide.go(">");
      });
    }

    splide.mount();
  }

  // Karuzela certyfikatów w sekcji "O mnie", zbudowana na bibliotece
  // Splide (https://splidejs.com/), na wzór techniczny jej przykładu
  // "Auto Width/Height": szerokość i wysokość każdego slajdu wynika z
  // jego własnej zawartości (autoWidth/autoHeight), a nie ze sztywnej,
  // jednakowej kolumny.
  // - "focus: center" + "type: loop" dają natywne, nieskończone przewijanie
  //   z aktywnym certyfikatem zawsze na środku — Splide sam dba o klony
  //   slajdów na granicach pętli, więc nie trzeba już ręcznie duplikować
  //   węzłów DOM ani liczyć aktywnego indeksu.
  // - Wbudowany moduł Autoplay przewija karuzelę samodzielnie i pauzuje po
  //   najechaniu/wejściu focusem (pauseOnHover/pauseOnFocus); dodatkowo
  //   pauzujemy go też na czas otwartego popupu z podglądem certyfikatu.
  // - Przy włączonym "prefers-reduced-motion" autoplay w ogóle się nie
  //   uruchamia.
  // - Klasę "is-active", którą Splide sam nakłada na bieżący slajd,
  //   wykorzystujemy do efektu powiększenia (o 20%) i ramki wokół aktywnego
  //   certyfikatu.
  // - Kliknięcie certyfikatu otwiera natywny <dialog> z powiększonym
  //   zdjęciem, strzałkami do przewijania i paskiem miniaturek wszystkich
  //   certyfikatów, na wyszarzonym tle strony.
  function initCertsCarousel() {
    var splideRoot = document.getElementById("certs-splide");
    if (!splideRoot || typeof Splide === "undefined") return;

    var wrapper = splideRoot.closest(".certs-carousel");
    var prevBtn = wrapper ? wrapper.querySelector("[data-certs-prev]") : null;
    var nextBtn = wrapper ? wrapper.querySelector("[data-certs-next]") : null;

    var reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Lista certyfikatów (źródło + nazwa) zbierana raz, zanim Splide
    // dopisze do toru swoje klony slajdów na potrzeby pętli — dzięki temu
    // popup zawsze operuje na dokładnie czterech oryginalnych certyfikatach,
    // niezależnie od tego, czy użytkownik kliknął oryginalny slajd, czy
    // jego klon widoczny przy zawijaniu karuzeli.
    var certs = Array.prototype.map.call(
      splideRoot.querySelectorAll("[data-cert-trigger]"),
      function (trigger) {
        // "fullSrc" to większa, ostrzejsza wersja certyfikatu (osobno
        // wyrenderowana z PDF-a w wyższej rozdzielczości) pokazywana w
        // powiększonym podglądzie; "thumbSrc" to ta sama mała grafika co w
        // karuzeli, użyta w pasku miniaturek popupu, żeby nie ściągać
        // dużych plików tylko po to, by wyświetlić je jako 68×48 px.
        var thumbImgEl = trigger.querySelector("img");
        return {
          fullSrc: trigger.getAttribute("data-full-src") || "",
          thumbSrc: thumbImgEl
            ? thumbImgEl.getAttribute("src")
            : trigger.getAttribute("data-full-src") || "",
          name: trigger.getAttribute("data-cert-name") || "",
        };
      },
    );

    var splide = new Splide(splideRoot, {
      type: "loop",
      autoWidth: true,
      autoHeight: true,
      focus: "center",
      gap: "28px",
      arrows: false,
      pagination: false,
      drag: true,
      // Przyspieszone przejście między slajdami (wcześniej 650ms) — karuzela
      // reaguje teraz wyraźnie szybciej na autoplay, strzałki i przeciąganie.
      speed: 380,
      easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      autoplay: !reduceMotion,
      interval: 4500,
      pauseOnHover: true,
      pauseOnFocus: true,
    });

    // Popup z powiększonym podglądem certyfikatu: zdjęcie, strzałki
    // poprzedni/następny i pasek miniaturek wszystkich certyfikatów do
    // szybkiego przełączania. Kliknięcie karty w głównej karuzeli
    // (delegacja na korzeniu Splide, więc działa też dla klonów slajdów
    // tworzonych przez pętlę) otwiera natywny <dialog> z wyszarzonym tłem
    // (::backdrop).
    var certModal = document.querySelector("[data-cert-modal]");
    var certModalImg = certModal
      ? certModal.querySelector("[data-cert-modal-img]")
      : null;
    var certModalClose = certModal
      ? certModal.querySelector("[data-cert-modal-close]")
      : null;
    var certModalPrev = certModal
      ? certModal.querySelector("[data-cert-modal-prev]")
      : null;
    var certModalNext = certModal
      ? certModal.querySelector("[data-cert-modal-next]")
      : null;
    var certModalThumbs = certModal
      ? certModal.querySelector("[data-cert-modal-thumbs]")
      : null;

    var isCertModalOpen = function () {
      return !!(certModal && certModal.open);
    };

    var pauseAutoplay = function () {
      if (splide.Components.Autoplay) splide.Components.Autoplay.pause();
    };
    var resumeAutoplay = function () {
      if (reduceMotion || isCertModalOpen()) return;
      if (splide.Components.Autoplay) splide.Components.Autoplay.play();
    };

    if (
      certModal &&
      certModalImg &&
      certModalClose &&
      certs.length &&
      typeof certModal.showModal === "function"
    ) {
      var currentModalIndex = 0;

      // Pasek miniaturek budowany raz, na starcie, z tych samych danych co
      // slajdy głównej karuzeli — jedno źródło prawdy, bez duplikowania
      // znaczników w HTML.
      if (certModalThumbs) {
        certs.forEach(function (cert, i) {
          var item = document.createElement("li");
          item.className = "cert-modal__thumb-item";

          var thumbBtn = document.createElement("button");
          thumbBtn.type = "button";
          thumbBtn.className = "cert-modal__thumb";
          thumbBtn.setAttribute("data-cert-modal-thumb", "");
          thumbBtn.setAttribute("data-index", String(i));
          thumbBtn.setAttribute(
            "aria-label",
            cert.name || "Certyfikat " + (i + 1),
          );

          var thumbImg = document.createElement("img");
          thumbImg.src = cert.thumbSrc;
          thumbImg.alt = "";
          thumbImg.loading = "lazy";

          thumbBtn.appendChild(thumbImg);
          item.appendChild(thumbBtn);
          certModalThumbs.appendChild(item);
        });
      }

      var certModalThumbButtons = certModalThumbs
        ? Array.prototype.slice.call(
            certModalThumbs.querySelectorAll("[data-cert-modal-thumb]"),
          )
        : [];

      // Podmienia zdjęcie i podświetla odpowiednią miniaturkę, bez zmiany
      // stanu otwarcia popupu — używane zarówno przy pierwszym otwarciu,
      // jak i przy przełączaniu strzałkami/miniaturkami.
      var showCertAt = function (index) {
        var cert = certs[(index + certs.length) % certs.length];
        if (!cert) return;
        currentModalIndex = (index + certs.length) % certs.length;
        certModalImg.src = cert.fullSrc;
        certModalImg.alt = cert.name
          ? "Powiększony podgląd: " + cert.name
          : "Powiększony podgląd certyfikatu";
        certModalThumbButtons.forEach(function (btn, i) {
          var isActive = i === currentModalIndex;
          btn.classList.toggle("is-active", isActive);
          if (isActive) {
            btn.setAttribute("aria-current", "true");
          } else {
            btn.removeAttribute("aria-current");
          }
        });
      };

      var openCertModal = function (index) {
        showCertAt(index);
        pauseAutoplay();
        certModal.showModal();
      };

      splideRoot.addEventListener("click", function (event) {
        var trigger = event.target.closest("[data-cert-trigger]");
        if (!trigger) return;
        var fullSrc = trigger.getAttribute("data-full-src");
        var index = certs.findIndex(function (cert) {
          return cert.fullSrc === fullSrc;
        });
        openCertModal(index === -1 ? 0 : index);
      });

      if (certModalThumbs) {
        certModalThumbs.addEventListener("click", function (event) {
          var thumbBtn = event.target.closest("[data-cert-modal-thumb]");
          if (!thumbBtn) return;
          showCertAt(parseInt(thumbBtn.getAttribute("data-index"), 10) || 0);
        });
      }

      if (certModalPrev) {
        certModalPrev.addEventListener("click", function () {
          showCertAt(currentModalIndex - 1);
        });
      }
      if (certModalNext) {
        certModalNext.addEventListener("click", function () {
          showCertAt(currentModalIndex + 1);
        });
      }

      // Strzałki klawiatury przełączają certyfikat, gdy popup jest otwarty.
      // Nasłuch na "document" (a nie na samym oknie dialogowym) działa
      // niezależnie od tego, na którym elemencie wewnątrz popupu aktualnie
      // znajduje się fokus.
      document.addEventListener("keydown", function (event) {
        if (!isCertModalOpen()) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          showCertAt(currentModalIndex + 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          showCertAt(currentModalIndex - 1);
        }
      });

      certModalClose.addEventListener("click", function () {
        certModal.close();
      });

      // Klik w tło (backdrop) natywnego <dialog> zamyka popup. Kliknięcie na
      // rzeczywistej treści okna (zdjęcie, strzałki, miniaturki) ustawia
      // "event.target" na ten konkretny element potomny, więc porównanie z
      // samym elementem <dialog> odróżnia klik w tło od kliknięcia treści —
      // w przeciwieństwie do porównywania współrzędnych kursora, które
      // błędnie zamykałoby popup przy aktywacji przycisku klawiaturą
      // (Enter/Spacja wywołują "click" ze współrzędnymi 0,0).
      certModal.addEventListener("click", function (event) {
        if (event.target === certModal) certModal.close();
      });

      // Obejmuje zamknięcie przez tło, przycisk zamknięcia i klawisz Escape
      // (natywna obsługa <dialog>) jednym miejscem wznawiającym autoplay.
      certModal.addEventListener("close", resumeAutoplay);
    }

    // Własne przyciski poprzedni/następny sterują karuzelą przez publiczne
    // API Splide zamiast ręcznego przewijania.
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        splide.go("<");
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        splide.go(">");
      });
    }

    splide.mount();
  }

  // Fasady map Google: osadzona mapa to ciężki zasób (skrypty + kafelki), a
  // strona lokalizacji ma ich 10. Zamiast ładować wszystkie naraz na starcie,
  // w HTML jest lekki placeholder, a właściwy <iframe> tworzymy dopiero wtedy,
  // gdy dany kafelek zbliża się do widoku (IntersectionObserver) — dzięki temu
  // mapy pojawiają się same podczas przewijania, ale strona startuje szybko i
  // nie ładuje map placówek, do których użytkownik nigdy nie dotrze. Kliknięcie
  // nadal działa jako natychmiastowe wczytanie.
  function initMapFacades() {
    var facades = document.querySelectorAll("[data-map-embed]");
    if (!facades.length) return;

    var loadMap = function (btn) {
      if (btn.getAttribute("data-map-loaded")) return;
      var src = btn.getAttribute("data-map-src");
      if (!src) return;
      btn.setAttribute("data-map-loaded", "1");
      var iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.title = btn.getAttribute("data-map-title") || "Mapa Google";
      iframe.loading = "lazy";
      iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      var parent = btn.parentNode;
      if (parent) parent.replaceChild(iframe, btn);
    };

    // Klik/aktywacja z klawiatury wczytuje mapę natychmiast.
    Array.prototype.forEach.call(facades, function (btn) {
      btn.addEventListener("click", function () {
        loadMap(btn);
      });
    });

    // Auto-ładowanie, gdy kafelek zbliża się do widoku. Bez wsparcia dla
    // IntersectionObserver ładujemy wszystkie od razu (zachowanie jak dawniej).
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              io.unobserve(entry.target);
              loadMap(entry.target);
            }
          });
        },
        { rootMargin: "300px 0px" },
      );
      Array.prototype.forEach.call(facades, function (btn) {
        io.observe(btn);
      });
    } else {
      Array.prototype.forEach.call(facades, function (btn) {
        loadMap(btn);
      });
    }
  }

  // Otwieranie natywnych aplikacji rezerwacji (Booksy, ZnanyLekarz) na
  // urządzeniach mobilnych. Adresy https są już powiązane z aplikacjami przez
  // App Links (Android) i Universal Links (iOS) — dane z plików assetlinks.json
  // / apple-app-site-association obu serwisów.
  //  - Android: budujemy adres intent:// z nazwą pakietu aplikacji oraz
  //    awaryjnym adresem (S.browser_fallback_url). Dzięki temu aplikacja otwiera
  //    się nawet gdy weryfikacja App Links jest wyłączona, a gdy aplikacji nie
  //    ma — przeglądarka otwiera zwykły adres https.
  //  - iOS: Universal Links odpalają się najpewniej przy zwykłym tapnięciu
  //    linku w TEJ SAMEJ karcie. Nie przechwytujemy więc kliknięcia (Apple
  //    ignoruje Universal Links przy nawigacji przez JS `window.location`) —
  //    zamiast tego usuwamy target="_blank" z linków rezerwacji, aby nawigacja
  //    była top-level. ZnanyLekarz: profile lekarzy są objęte Universal Links,
  //    więc apka otworzy się sama. Booksy: zwykłe adresy https NIE są objęte
  //    (apka przejmuje tylko /link/* i */rwg/*), dlatego link Booksy przepisujemy
  //    na link Branch (cdl.booksy.com) — patrz szczegóły niżej. Bez apki: Safari.
  // Na desktopie nie zmieniamy nic — link otwiera się w nowej karcie.
  function initBookingDeepLinks() {
    var ua = navigator.userAgent || "";
    var isAndroid = /Android/i.test(ua);
    // iPadOS 13+ potrafi przedstawiać się jako "Macintosh" — wykrywamy też dotyk.
    var isIOS =
      /iPhone|iPad|iPod/i.test(ua) ||
      (/Macintosh/i.test(ua) && "ontouchend" in document);
    if (!isAndroid && !isIOS) return;

    // Host -> nazwa pakietu aplikacji na Androidzie (źródło: assetlinks.json).
    var androidPackages = {
      "booksy.com": "net.booksy.customer",
      "www.booksy.com": "net.booksy.customer",
      "znanylekarz.pl": "pl.znanylekarz",
      "www.znanylekarz.pl": "pl.znanylekarz",
    };

    var isBookingHost = function (link) {
      var url;
      try {
        url = new URL(link.href);
      } catch (e) {
        return null;
      }
      if (url.protocol !== "https:") return null;
      return androidPackages[url.host] ? url : null;
    };

    if (isIOS) {
      // Zwykłe tapnięcie linku w TEJ SAMEJ karcie daje największą szansę na
      // uruchomienie Universal Links, dlatego usuwamy otwieranie w nowej karcie.
      // Dla Booksy dodatkowo przepisujemy adres na link Branch (cdl.booksy.com):
      //   - dane autorytatywne z API Branch (app-link-settings) dla klucza klienta
      //     Booksy: ios_uri_scheme booksy://, ios_bundle_id com.sensi.BooksyCUST,
      //     short_url_domain cdl.booksy.com (domena jest w apple-app-site-association
      //     apki, dopasowanie /*), default_short_url_domain lhkw.app.link;
      //   - dzięki temu na iOS z zainstalowaną apką Universal Link otwiera aplikację
      //     Booksy (Branch przekazuje $canonical_url/$deeplink_path do routingu),
      //     a bez apki następują czyste przekierowania (bez ekranu pośredniego)
      //     na dokładny adres rezerwacji w Safari — bez komunikatu o błędzie.
      // UWAGA (eksperyment): jeśli apka Booksy nie rozpozna $canonical_url, może
      //   otworzyć ekran główny zamiast strony rezerwacji. Zwykłe linki https
      //   Booksy NIE są objęte Universal Links (Booksy przejmuje tylko /link/*
      //   i */rwg/*), dlatego bez tej sztuczki apka na iOS w ogóle się nie otworzy.
      var BOOKSY_BRANCH_KEY = "key_live_flhKTnRyt5fr4gPqB7FzBnmmFyhDVlR1";
      var BOOKSY_BRANCH_DOMAIN = "cdl.booksy.com";
      var booksyHosts = { "booksy.com": 1, "www.booksy.com": 1 };

      var buildBooksyBranchLink = function (url) {
        // Adres rezerwacji bez #fragmentu (fragment nie trafia na serwer).
        var target = url.origin + url.pathname + url.search;
        var enc = encodeURIComponent(target);
        return (
          "https://" +
          BOOKSY_BRANCH_DOMAIN +
          "/a/" +
          BOOKSY_BRANCH_KEY +
          "?%24canonical_url=" +
          enc +
          "&%24ios_url=" +
          enc +
          "&%24fallback_url=" +
          enc +
          "&%24deeplink_path=" +
          encodeURIComponent(url.pathname + url.search)
        );
      };

      var links = document.querySelectorAll('a[href][target="_blank"]');
      Array.prototype.forEach.call(links, function (link) {
        var url = isBookingHost(link);
        if (!url) return;
        link.target = "_self";
        if (booksyHosts[url.host]) link.href = buildBooksyBranchLink(url);
      });
      return;
    }

    // Android: klik -> intent:// (apka albo — jako fallback — przeglądarka).
    var buildIntentUrl = function (url, pkg) {
      // intent://HOST/PATH?QUERY#Intent;scheme=https;package=PKG;
      //   S.browser_fallback_url=...;end
      // Fragment (#...) pomijamy w danych intencji (nie służy do dopasowania
      // App Links), ale pełny adres zachowujemy jako awaryjny dla przeglądarki.
      var hostAndPath = url.host + url.pathname + url.search;
      return (
        "intent://" +
        hostAndPath +
        "#Intent;scheme=https;package=" +
        pkg +
        ";S.browser_fallback_url=" +
        encodeURIComponent(url.href) +
        ";end"
      );
    };

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented || (event.button && event.button !== 0)) {
        return;
      }
      var link = event.target.closest && event.target.closest("a[href]");
      if (!link) return;
      var url = isBookingHost(link);
      if (!url) return; // link inny niż Booksy/ZnanyLekarz — nie ruszamy

      event.preventDefault();
      window.location.href = buildIntentUrl(url, androidPackages[url.host]);
    });
  }

  // Prefetch stron tego samego pochodzenia po najechaniu/dotknięciu linku
  // (uzupełnia Speculation Rules tam, gdzie prerender nie jest wspierany).
  function initPrefetch() {
    var test = document.createElement("link");
    if (
      !test.relList ||
      !test.relList.supports ||
      !test.relList.supports("prefetch")
    ) {
      return;
    }
    var seen = {};
    var prefetch = function (url) {
      if (seen[url]) return;
      seen[url] = true;
      var link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url;
      document.head.appendChild(link);
    };
    var onIntent = function (event) {
      var a = event.target.closest && event.target.closest("a[href]");
      if (!a) return;
      if (a.origin !== location.origin) return;
      if (a.protocol !== "http:" && a.protocol !== "https:") return;
      if (a.href === location.href) return;
      if (a.hash && a.pathname === location.pathname) return;
      prefetch(a.href);
    };
    document.addEventListener("pointerover", onIntent, { passive: true });
    document.addEventListener("touchstart", onIntent, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
