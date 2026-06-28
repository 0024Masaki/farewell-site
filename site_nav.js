(function () {
    const nav = document.querySelector('[data-site-nav]');

    if (!nav) {
        return;
    }

    const toggleButton = nav.querySelector('[data-site-nav-toggle]');
    const menu = nav.querySelector('[data-site-nav-menu]');

    document.body.classList.add('has-site-nav');

    if (!toggleButton || !menu) {
        return;
    }

    function setMenuOpen(isOpen) {
        nav.classList.toggle('is-open', isOpen);
        toggleButton.setAttribute('aria-expanded', String(isOpen));
    }

    toggleButton.addEventListener('click', function () {
        setMenuOpen(!nav.classList.contains('is-open'));
    });

    menu.addEventListener('click', function (event) {
        if (event.target.closest('a')) {
            setMenuOpen(false);
        }
    });

    document.addEventListener('click', function (event) {
        if (!nav.contains(event.target)) {
            setMenuOpen(false);
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            setMenuOpen(false);
        }
    });
})();
