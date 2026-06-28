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

    function isSummaryVisible(settings) {
        if (!settings || settings.summary_enabled === false) {
            return false;
        }

        return settings.show_photo_list !== false || settings.show_message_list !== false;
    }

    function applySummaryLinkVisibility(settings) {
        const visible = isSummaryVisible(settings);

        menu.querySelectorAll('a[href="/summary.html"]').forEach(function (link) {
            link.hidden = !visible;
            link.classList.toggle('is-hidden', !visible);
            link.setAttribute('aria-hidden', String(!visible));
            link.tabIndex = visible ? 0 : -1;
        });
    }

    async function loadSummaryNavSettings() {
        try {
            const response = await fetch('/api/summary?meta=1&t=' + Date.now(), {
                cache: 'no-store',
                headers: {
                    'accept': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                applySummaryLinkVisibility(null);
                return;
            }

            applySummaryLinkVisibility(data.settings || null);
        } catch (error) {
            applySummaryLinkVisibility(null);
        }
    }

    function createRecipientDropdown(recipients) {
        if (!Array.isArray(recipients) || recipients.length === 0) {
            return;
        }

        if (menu.querySelector('[data-recipient-dropdown]')) {
            return;
        }

        const dropdown = document.createElement('details');
        dropdown.className = 'site-nav-dropdown';
        dropdown.setAttribute('data-recipient-dropdown', '');

        const summary = document.createElement('summary');
        summary.textContent = '紹介者ページ';
        dropdown.appendChild(summary);

        const list = document.createElement('div');
        list.className = 'site-nav-dropdown-list';

        recipients.forEach(function (recipient) {
            const id = String(recipient && recipient.id ? recipient.id : '').trim();
            const name = String(recipient && recipient.name ? recipient.name : '').trim();

            if (!id || !name) {
                return;
            }

            const link = document.createElement('a');
            link.href = '/person.html?id=' + encodeURIComponent(id);
            link.textContent = name;
            list.appendChild(link);
        });

        if (!list.children.length) {
            return;
        }

        dropdown.appendChild(list);

        const topLink = menu.querySelector('a[href="/index.html"]');

        if (topLink && topLink.nextSibling) {
            menu.insertBefore(dropdown, topLink.nextSibling);
            return;
        }

        if (topLink) {
            menu.appendChild(dropdown);
            return;
        }

        menu.insertBefore(dropdown, menu.firstChild);
    }

    async function loadRecipientDropdown() {
        try {
            const response = await fetch('/api/recipients', {
                headers: {
                    'accept': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                return;
            }

            createRecipientDropdown(data.recipients || []);
        } catch (error) {
            // ナビ本体の表示を止めないため、紹介者リスト取得失敗時は何もしない
        }
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

            menu.querySelectorAll('details[open]').forEach(function (details) {
                details.open = false;
            });
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            setMenuOpen(false);

            menu.querySelectorAll('details[open]').forEach(function (details) {
                details.open = false;
            });
        }
    });

    loadSummaryNavSettings();
    loadRecipientDropdown();
})();
