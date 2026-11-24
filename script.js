const trigger = document.querySelector('.film-trigger');
const film = document.querySelector('.film');
const canvas = film.querySelector('canvas');

function resizeFilm() {
    canvas.width = film.clientWidth;
    canvas.height = film.clientHeight;
    ObservatoryAnimation.resize();
}

if (typeof ObservatoryAnimation !== 'undefined' && typeof film.showModal === 'function') {
    trigger.hidden = false;

    trigger.addEventListener('click', () => {
        film.showModal();
        resizeFilm();
        ObservatoryAnimation.start(canvas, () => film.close());
        window.addEventListener('resize', resizeFilm);
    });

    film.addEventListener('close', () => {
        ObservatoryAnimation.stop();
        window.removeEventListener('resize', resizeFilm);
        trigger.focus();
    });
}
