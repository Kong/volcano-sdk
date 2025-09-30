/* global Prism, document, window, IntersectionObserver, setTimeout, history, navigator, console */
(function() {
  'use strict';

  // Syntax highlighting
  if (typeof Prism !== 'undefined') {
    Prism.highlightAll();
  }

  // Generate Table of Contents dynamically
  function generateTOC() {
    const tocNav = document.getElementById('toc-nav');
    if (!tocNav) return;

    const contentInner = document.querySelector('.content-inner');
    if (!contentInner) return;

    // Get only h2 headings (top-level sections)
    const headings = contentInner.querySelectorAll('h2');
    
    headings.forEach(heading => {
      // Generate ID from text if it doesn't have one
      if (!heading.id) {
        const text = heading.textContent.trim();
        // Remove emojis, special chars, convert to lowercase, replace spaces with hyphens
        heading.id = text
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove all emojis
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
      }
      
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.className = 'toc-link';
      link.textContent = heading.textContent.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      tocNav.appendChild(link);
    });
  }

  // Call TOC generation
  generateTOC();

  // Set active state based on current page URL
  function setActiveSidebarLink() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const currentHash = window.location.hash;
    
    let hasActiveLink = false;
    
    // Update all at once to prevent flashing
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (!href) {
        link.classList.remove('active');
        return;
      }
      
      let isActive = false;
      
      // Parse link href
      const hrefParts = href.split('#');
      const hrefPage = hrefParts[0] || currentPath;
      const hrefHash = hrefParts.length > 1 ? '#' + hrefParts[1] : '';
      
      // Check if this link should be active
      if (currentHash) {
        // We have a hash - match both page and hash
        if (hrefPage === currentPath && hrefHash === currentHash) {
          isActive = true;
        }
      } else {
        // No hash - match page only (prefer links without hash)
        if (hrefPage === currentPath && !hrefHash) {
          isActive = true;
        }
      }
      
      if (isActive) {
        link.classList.add('active');
        hasActiveLink = true;
      } else {
        link.classList.remove('active');
      }
    });
    
    // If no link was activated and we have a hash, try to activate it
    if (!hasActiveLink && currentHash) {
      document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.endsWith(currentHash)) {
          link.classList.add('active');
        }
      });
    }
  }
  
  // Scroll active sidebar link into view on page load
  function scrollActiveNavIntoView() {
    setActiveSidebarLink(); // Set active state first
    
    // If no active link and we're on a page without hash, activate first section link
    let activeLink = document.querySelector('.sidebar-nav .nav-link.active');
    if (!activeLink && !window.location.hash) {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';
      const firstSectionLink = document.querySelector(`.sidebar-nav .nav-link[href^="${currentPage}#"]`);
      if (firstSectionLink) {
        firstSectionLink.classList.add('active');
        activeLink = firstSectionLink;
      }
    }
    
    if (activeLink) {
      setTimeout(() => {
        activeLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }
  scrollActiveNavIntoView();

  // Add click handlers to sidebar links to update active state immediately
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', function() {
      // Remove active from all
      document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => {
        l.classList.remove('active');
      });
      // Add active to clicked link
      this.classList.add('active');
    });
  });

  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      
      if (target) {
        const offset = 24;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
        
        // Update URL without jumping
        history.pushState(null, null, href);
      }
    });
  });

  // Active navigation highlighting
  const observerOptions = {
    root: null,
    rootMargin: '-80px 0px -80% 0px',
    threshold: 0
  };

  let activeId = null;
  const observer = new IntersectionObserver((entries) => {
    // Find the first intersecting entry
    const intersecting = entries.find(entry => entry.isIntersecting);
    if (intersecting) {
      const id = intersecting.target.getAttribute('id');
      if (!id || id === activeId) return;
      
      activeId = id;

      // Update TOC nav only (not sidebar nav to prevent flashing)
      document.querySelectorAll('.toc-link').forEach(link => {
        if (link.getAttribute('href') === `#${id}`) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }
  }, observerOptions);

  // Observe all sections with IDs
  document.querySelectorAll('section[id], h2[id], h3[id]').forEach(element => {
    observer.observe(element);
  });

  // Update active state when hash changes (clicking TOC links)
  window.addEventListener('hashchange', () => {
    setActiveSidebarLink();
  });

  // Mobile menu toggle (if needed)
  const createMobileToggle = () => {
    if (window.innerWidth > 1024) return;

    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Create toggle button if it doesn't exist
    let toggle = document.querySelector('.mobile-menu-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.className = 'mobile-menu-toggle';
      toggle.innerHTML = '☰';
      toggle.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 101;
        background: var(--primary-gradient);
        color: white;
        border: none;
        width: 44px;
        height: 44px;
        border-radius: 8px;
        font-size: 20px;
        cursor: pointer;
        box-shadow: var(--shadow-md);
      `;
      document.body.appendChild(toggle);

      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
          overlay.classList.toggle('visible');
        }
      });
    }

    // Create overlay if it doesn't exist
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 99;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(overlay);

      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
      });
    }

    // Add visible class styles
    const style = document.createElement('style');
    style.textContent = `
      .sidebar-overlay.visible {
        opacity: 1;
        pointer-events: auto;
      }
    `;
    document.head.appendChild(style);
  };

  // Initialize mobile menu on load and resize
  createMobileToggle();
  window.addEventListener('resize', createMobileToggle);

  // Close mobile menu when clicking on a link
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('visible');
      }
    });
  });

  // Copy code button
  document.querySelectorAll('.code-block').forEach(block => {
    const button = document.createElement('button');
    button.className = 'copy-button';
    button.textContent = 'Copy';
    button.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(255, 255, 255, 0.15)';
      button.style.color = '#e2e8f0';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(255, 255, 255, 0.1)';
      button.style.color = '#94a3b8';
    });

    button.addEventListener('click', async () => {
      const code = block.querySelector('code');
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = 'Copied!';
        button.style.background = 'rgba(34, 197, 94, 0.2)';
        button.style.borderColor = 'rgba(34, 197, 94, 0.4)';
        button.style.color = '#22c55e';

        setTimeout(() => {
          button.textContent = 'Copy';
          button.style.background = 'rgba(255, 255, 255, 0.1)';
          button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          button.style.color = '#94a3b8';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });

    block.style.position = 'relative';
    block.appendChild(button);
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K to focus search (if you add search later)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      // Focus search input if it exists
      const searchInput = document.querySelector('.search-input');
      if (searchInput) {
        searchInput.focus();
      }
    }
  });

})();
