/**
 * Admin Mobile Navigation — hamburger menu + sidebar toggle + scroll fix
 * Safe: Does NOT modify any existing DOM content, only adds hamburger & overlay
 */
(function () {
  function init() {
    var sidebar = document.querySelector('aside');
    if (!sidebar) return;

    // ── FIX SCROLL: Override Tailwind h-screen overflow-hidden on mobile ──
    if (window.innerWidth < 1024) {
      // Find the wrapper div (flex h-screen overflow-hidden)
      var wrapper = document.querySelector('.flex.h-screen');
      if (wrapper) {
        wrapper.style.display = 'block';
        wrapper.style.height = 'auto';
        wrapper.style.minHeight = '100vh';
        wrapper.style.overflow = 'visible';
        wrapper.style.overflowX = 'hidden';
      }
      // Fix main to not be flex child
      var main = document.querySelector('main');
      if (main) {
        main.style.display = 'block';
        main.style.width = '100%';
        main.style.minHeight = '100vh';
        main.style.overflowY = 'auto';
        main.style.overflowX = 'hidden';
      }
    }

    // ── Create hamburger button ──
    if (document.querySelector('.admin-hamburger')) return; // prevent duplicates

    var hamburger = document.createElement('button');
    hamburger.className = 'admin-hamburger';
    hamburger.setAttribute('aria-label', 'Toggle menu');
    hamburger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';

    // Only show on mobile
    if (window.innerWidth >= 1024) {
      hamburger.style.display = 'none';
    }

    document.body.appendChild(hamburger);

    // ── Create overlay ──
    var overlay = document.createElement('div');
    overlay.className = 'admin-sidebar-overlay';
    document.body.appendChild(overlay);

    // ── Toggle logic ──
    var menuIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    var closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    function openSidebar() {
      sidebar.classList.add('sidebar-open');
      overlay.classList.add('active');
      hamburger.innerHTML = closeIcon;
      document.body.style.overflow = 'hidden'; // prevent background scroll
    }

    function closeSidebar() {
      sidebar.classList.remove('sidebar-open');
      overlay.classList.remove('active');
      hamburger.innerHTML = menuIcon;
      document.body.style.overflow = ''; // restore scroll
    }

    hamburger.addEventListener('click', function () {
      if (sidebar.classList.contains('sidebar-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    overlay.addEventListener('click', closeSidebar);

    // Close sidebar when clicking a nav link
    var navLinks = sidebar.querySelectorAll('a');
    for (var i = 0; i < navLinks.length; i++) {
      navLinks[i].addEventListener('click', closeSidebar);
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Handle window resize
  window.addEventListener('resize', function () {
    var hamburger = document.querySelector('.admin-hamburger');
    var overlay = document.querySelector('.admin-sidebar-overlay');
    var sidebar = document.querySelector('aside');
    var wrapper = document.querySelector('.flex.h-screen, [class*="flex"][class*="h-screen"]');
    var main = document.querySelector('main');

    if (window.innerWidth >= 1024) {
      // Desktop: restore original layout
      if (hamburger) hamburger.style.display = 'none';
      if (overlay) overlay.classList.remove('active');
      if (sidebar) sidebar.classList.remove('sidebar-open');
      if (wrapper) {
        wrapper.style.display = '';
        wrapper.style.height = '';
        wrapper.style.minHeight = '';
        wrapper.style.overflow = '';
        wrapper.style.overflowX = '';
      }
      if (main) {
        main.style.display = '';
        main.style.width = '';
        main.style.minHeight = '';
        main.style.overflowY = '';
        main.style.overflowX = '';
      }
      document.body.style.overflow = '';
    } else {
      // Mobile: apply fixes
      if (hamburger) hamburger.style.display = 'flex';
      if (wrapper) {
        wrapper.style.display = 'block';
        wrapper.style.height = 'auto';
        wrapper.style.minHeight = '100vh';
        wrapper.style.overflow = 'visible';
        wrapper.style.overflowX = 'hidden';
      }
      if (main) {
        main.style.display = 'block';
        main.style.width = '100%';
        main.style.minHeight = '100vh';
        main.style.overflowY = 'auto';
        main.style.overflowX = 'hidden';
      }
    }
  });
})();
