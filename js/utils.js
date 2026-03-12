// Utility functions

/**
 * Simple error handling utility.
 * @param {Function} func - The function to execute.
 * @param {...any} args - Arguments to pass to the function.
 * @returns {any} - The result of the function or logs an error.
 */
function handleErrors(func, ...args) {
    try {
        return func(...args);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

/**
 * Input sanitization utility.
 * @param {string} input - The user input to sanitize.
 * @returns {string} - The sanitized string.
 */
function sanitizeInput(input) {
    return input.replace(/<script.*?>.*?<\/script>/gi, '').trim();
}

/**
 * DOM Manipulation Helpers
 */

/**
 * Create an element with specified attributes.
 * @param {string} tag - The tag name of the element.
 * @param {object} attributes - The attributes to set on the element.
 * @returns {HTMLElement} - The created element.
 */
function createElement(tag, attributes = {}) {
    const element = document.createElement(tag);
    for (const key in attributes) {
        element.setAttribute(key, attributes[key]);
    }
    return element;
}

/**
 * Append an element to a parent.
 * @param {HTMLElement} parent - The parent element to append to.
 * @param {HTMLElement} child - The child element to append.
 */
function appendTo(parent, child) {
    parent.appendChild(child);
}