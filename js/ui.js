// ui.js

// Toast Notification Component
const showToast = (message, duration = 3000) => {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, duration);
};

// Modal Component
const openModal = (content) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class='modal-content'>${content}<button onclick='closeModal()'>Close</button></div>`;
    document.body.appendChild(modal);
};

const closeModal = () => {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
};

// Card Component
const createCard = (title, description) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${title}</h3><p>${description}</p>`;
    return card;
};

// Loader Component
const showLoader = () => {
    const loader = document.createElement('div');
    loader.className = 'loader';
    document.body.appendChild(loader);
};

const hideLoader = () => {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.remove();
    }
};

// Export components
export { showToast, openModal, createCard, showLoader, hideLoader };