// video-player.js

class VideoPlayer {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.fullscreenEnabled = false;
    }

    toggleFullscreen() {
        if (!this.fullscreenEnabled) {
            if (this.videoElement.requestFullscreen) {
                this.videoElement.requestFullscreen();
            } else if (this.videoElement.mozRequestFullScreen) { // Firefox
                this.videoElement.mozRequestFullScreen();
            } else if (this.videoElement.webkitRequestFullscreen) { // Chrome, Safari and Opera
                this.videoElement.webkitRequestFullscreen();
            } else if (this.videoElement.msRequestFullscreen) { // IE/Edge
                this.videoElement.msRequestFullscreen();
            }
            this.fullscreenEnabled = true;
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            this.fullscreenEnabled = false;
        }
    }

    selectServer(servers) {
        // Logic for server selection
        // Sample implementation, should be adjusted according to needs
        const serverSelectElement = document.createElement('select');
        servers.forEach(server => {
            const option = document.createElement('option');
            option.value = server;
            option.textContent = server;
            serverSelectElement.appendChild(option);
        });
        serverSelectElement.addEventListener('change', (event) => {
            // Change server logic based on selection
            console.log(`Selected server: ${event.target.value}`);
        });
        document.body.appendChild(serverSelectElement);
    }
}

// Usage:
// const player = new VideoPlayer(document.querySelector('video'));
// player.toggleFullscreen();
// player.selectServer(['server1', 'server2']);
