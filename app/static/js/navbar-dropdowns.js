// Replace CSS :hover dropdowns with click/tap for touch device support
(function () {

    // Works for both .nav-dropdown (Collection menu) and .user-menu (profile menu)
    const dropdowns = document.querySelectorAll('.nav-dropdown, .user-menu');

    dropdowns.forEach(function (dropdown) {
        const trigger = dropdown.querySelector(
            '.nav-link--arrow, .user-menu__trigger'
        );
        const menu = dropdown.querySelector(
            '.nav-dropdown__menu, .user-menu__dropdown'
        );

        if (!trigger || !menu) return;

        // Force menu to be JS-controlled — remove CSS :hover behaviour
        // by adding a class that overrides it
        dropdown.classList.add('js-dropdown');

        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            const isOpen = menu.classList.toggle('is-open');
            trigger.setAttribute('aria-expanded', isOpen);

            // Close all other dropdowns
            dropdowns.forEach(function (other) {
                if (other !== dropdown) {
                    other.querySelector('.nav-dropdown__menu, .user-menu__dropdown')
                        ?.classList.remove('is-open');
                    other.querySelector('.nav-link--arrow, .user-menu__trigger')
                        ?.setAttribute('aria-expanded', 'false');
                }
            });
        });
    });

    // Close all dropdowns when clicking outside
    document.addEventListener('click', function () {
        dropdowns.forEach(function (dropdown) {
            dropdown.querySelector('.nav-dropdown__menu, .user-menu__dropdown')
                ?.classList.remove('is-open');
            dropdown.querySelector('.nav-link--arrow, .user-menu__trigger')
                ?.setAttribute('aria-expanded', 'false');
        });
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            dropdowns.forEach(function (dropdown) {
                dropdown.querySelector('.nav-dropdown__menu, .user-menu__dropdown')
                    ?.classList.remove('is-open');
            });
        }
    });
})();