/**
 * PWA Utilities
 * Mobile optimizations, touch gestures, install prompt, and PWA features
 */

class PWAUtils {
  constructor() {
    this.installPromptEvent = null;
    this.isInstalled = false;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
    this.swipeThreshold = 50;
    this.tapThreshold = 10;
    this.longPressThreshold = 500;
    this.doubleTapThreshold = 300;
    
    this.gestureCallbacks = {
      swipeLeft: [],
      swipeRight: [],
      swipeUp: [],
      swipeDown: [],
      tap: [],
      doubleTap: [],
      longPress: [],
      pinch: [],
      pullToRefresh: []
    };
    
    this.lastTap = 0;
    this.longPressTimer = null;
    this.pullToRefreshActive = false;
    
    this.init();
  }
  
  /**
   * Initialize PWA utilities
   */
  init() {
    this.setupInstallPrompt();
    this.setupTouchGestures();
    this.setupViewportMeta();
    this.setupMobileOptimizations();
    this.checkInstallStatus();
    
    console.log('[PWAUtils] Initialized');
  }
  
  // =============================================================================
  // INSTALL PROMPT MANAGEMENT
  // =============================================================================
  
  /**
   * Setup install prompt handling
   */
  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log('[PWAUtils] Install prompt available');
      event.preventDefault();
      this.installPromptEvent = event;
    });
    
    window.addEventListener('appinstalled', () => {
      console.log('[PWAUtils] App installed');
      this.isInstalled = true;
      this.installPromptEvent = null;
    });
  }
  
  /**
   * Check if app can be installed
   */
  canInstall() {
    return this.installPromptEvent !== null;
  }
  
  /**
   * Show install prompt
   */
  async showInstallPrompt() {
    if (!this.installPromptEvent) {
      return { success: false, reason: 'no_prompt_available' };
    }
    
    try {
      const result = await this.installPromptEvent.prompt();
      const outcome = await this.installPromptEvent.userChoice;
      
      console.log('[PWAUtils] Install prompt result:', outcome);
      
      this.installPromptEvent = null;
      
      return {
        success: outcome.outcome === 'accepted',
        outcome: outcome.outcome
      };
    } catch (error) {
      console.error('[PWAUtils] Error showing install prompt:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check if app is installed
   */
  checkInstallStatus() {
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://')) {
      this.isInstalled = true;
      console.log('[PWAUtils] App is installed');
    }
    
    return this.isInstalled;
  }
  
  /**
   * Get install status
   */
  getInstallStatus() {
    return {
      isInstalled: this.isInstalled,
      canInstall: this.canInstall(),
      isStandalone: window.matchMedia('(display-mode: standalone)').matches
    };
  }
  
  // =============================================================================
  // TOUCH GESTURES
  // =============================================================================
  
  /**
   * Setup touch gesture handling
   */
  setupTouchGestures() {
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    
    // Prevent zoom on double tap
    document.addEventListener('touchend', (event) => {
      if (event.touches.length < 2) {
        event.preventDefault();
      }
    });
    
    console.log('[PWAUtils] Touch gestures enabled');
  }
  
  /**
   * Handle touch start
   */
  handleTouchStart(event) {
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    
    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      this.triggerGesture('longPress', {
        x: this.touchStartX,
        y: this.touchStartY,
        target: event.target
      });
    }, this.longPressThreshold);
  }
  
  /**
   * Handle touch move
   */
  handleTouchMove(event) {
    // Cancel long press if moving
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    
    // Handle pull to refresh
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaY = touch.clientY - this.touchStartY;
      
      if (window.scrollY === 0 && deltaY > 0) {
        this.handlePullToRefresh(deltaY);
      }
    }
    
    // Handle pinch gesture
    if (event.touches.length === 2) {
      this.handlePinchGesture(event);
    }
  }
  
  /**
   * Handle touch end
   */
  handleTouchEnd(event) {
    // Clear long press timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    
    const touch = event.changedTouches[0];
    this.touchEndX = touch.clientX;
    this.touchEndY = touch.clientY;
    
    const deltaX = this.touchEndX - this.touchStartX;
    const deltaY = this.touchEndY - this.touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Handle tap and double tap
    if (distance < this.tapThreshold) {
      this.handleTap(event);
    }
    
    // Handle swipe gestures
    if (Math.abs(deltaX) > this.swipeThreshold || Math.abs(deltaY) > this.swipeThreshold) {
      this.handleSwipe(deltaX, deltaY, event);
    }
    
    // Reset pull to refresh
    if (this.pullToRefreshActive) {
      this.resetPullToRefresh();
    }
  }
  
  /**
   * Handle tap gesture
   */
  handleTap(event) {
    const now = Date.now();
    const timeSinceLastTap = now - this.lastTap;
    
    if (timeSinceLastTap < this.doubleTapThreshold) {
      // Double tap
      this.triggerGesture('doubleTap', {
        x: this.touchEndX,
        y: this.touchEndY,
        target: event.target
      });
    } else {
      // Single tap
      this.triggerGesture('tap', {
        x: this.touchEndX,
        y: this.touchEndY,
        target: event.target
      });
    }
    
    this.lastTap = now;
  }
  
  /**
   * Handle swipe gesture
   */
  handleSwipe(deltaX, deltaY, event) {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    if (absX > absY) {
      // Horizontal swipe
      if (deltaX > 0) {
        this.triggerGesture('swipeRight', {
          distance: absX,
          target: event.target
        });
      } else {
        this.triggerGesture('swipeLeft', {
          distance: absX,
          target: event.target
        });
      }
    } else {
      // Vertical swipe
      if (deltaY > 0) {
        this.triggerGesture('swipeDown', {
          distance: absY,
          target: event.target
        });
      } else {
        this.triggerGesture('swipeUp', {
          distance: absY,
          target: event.target
        });
      }
    }
  }
  
  /**
   * Handle pull to refresh
   */
  handlePullToRefresh(deltaY) {
    const maxPull = 120;
    const pullRatio = Math.min(deltaY / maxPull, 1);
    
    if (pullRatio > 0.3 && !this.pullToRefreshActive) {
      this.pullToRefreshActive = true;
      document.body.classList.add('pull-to-refresh-active');
    }
    
    if (pullRatio >= 1) {
      this.triggerGesture('pullToRefresh', {
        distance: deltaY,
        ratio: pullRatio
      });
    }
  }
  
  /**
   * Reset pull to refresh
   */
  resetPullToRefresh() {
    this.pullToRefreshActive = false;
    document.body.classList.remove('pull-to-refresh-active');
  }
  
  /**
   * Handle pinch gesture
   */
  handlePinchGesture(event) {
    if (event.touches.length !== 2) return;
    
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
    
    this.triggerGesture('pinch', {
      distance,
      centerX: (touch1.clientX + touch2.clientX) / 2,
      centerY: (touch1.clientY + touch2.clientY) / 2
    });
  }
  
  /**
   * Trigger gesture callback
   */
  triggerGesture(gestureType, data) {
    const callbacks = this.gestureCallbacks[gestureType];
    if (callbacks && callbacks.length > 0) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[PWAUtils] Error in ${gestureType} callback:`, error);
        }
      });
    }
  }
  
  /**
   * Add gesture event listener
   */
  addGestureListener(gestureType, callback) {
    if (this.gestureCallbacks[gestureType]) {
      this.gestureCallbacks[gestureType].push(callback);
    }
  }
  
  /**
   * Remove gesture event listener
   */
  removeGestureListener(gestureType, callback) {
    if (this.gestureCallbacks[gestureType]) {
      const index = this.gestureCallbacks[gestureType].indexOf(callback);
      if (index > -1) {
        this.gestureCallbacks[gestureType].splice(index, 1);
      }
    }
  }
  
  // =============================================================================
  // MOBILE OPTIMIZATIONS
  // =============================================================================
  
  /**
   * Setup viewport meta tag
   */
  setupViewportMeta() {
    let viewport = document.querySelector('meta[name=viewport]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
  }
  
  /**
   * Setup mobile-specific optimizations
   */
  setupMobileOptimizations() {
    // Disable text selection on UI elements
    document.addEventListener('selectstart', (event) => {
      if (event.target.matches('.no-select, button, .btn, .card-drag-handle')) {
        event.preventDefault();
      }
    });
    
    // Improve scroll performance
    document.body.style.webkitOverflowScrolling = 'touch';
    
    // Prevent bounce scrolling
    document.body.addEventListener('touchmove', (event) => {
      if (event.target === document.body) {
        event.preventDefault();
      }
    }, { passive: false });
    
    // Add mobile-specific CSS classes
    document.body.classList.add('mobile-optimized');
    
    if (this.isMobile()) {
      document.body.classList.add('is-mobile');
    }
    
    if (this.isTablet()) {
      document.body.classList.add('is-tablet');
    }
    
    console.log('[PWAUtils] Mobile optimizations applied');
  }
  
  /**
   * Check if device is mobile
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  }
  
  /**
   * Check if device is tablet
   */
  isTablet() {
    return /iPad|Android.*Tablet|Windows.*Touch/i.test(navigator.userAgent) ||
           (window.innerWidth > 768 && window.innerWidth <= 1024);
  }
  
  /**
   * Get device info
   */
  getDeviceInfo() {
    return {
      isMobile: this.isMobile(),
      isTablet: this.isTablet(),
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      orientation: screen.orientation?.angle || 0
    };
  }
  
  // =============================================================================
  // NETWORK STATUS
  // =============================================================================
  
  /**
   * Get network information
   */
  getNetworkInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    return {
      isOnline: navigator.onLine,
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
      saveData: connection?.saveData || false
    };
  }
  
  /**
   * Check if on slow connection
   */
  isSlowConnection() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    return connection?.effectiveType === 'slow-2g' || 
           connection?.effectiveType === '2g' ||
           connection?.saveData === true;
  }
  
  // =============================================================================
  // CAMERA AND MEDIA
  // =============================================================================
  
  /**
   * Capture photo from camera
   */
  async capturePhoto(options = {}) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: options.facingMode || 'environment',
          width: { ideal: options.width || 1920 },
          height: { ideal: options.height || 1080 }
        }
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      return new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          context.drawImage(video, 0, 0);
          
          // Stop the stream
          stream.getTracks().forEach(track => track.stop());
          
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to capture photo'));
            }
          }, options.format || 'image/jpeg', options.quality || 0.8);
        });
      });
    } catch (error) {
      console.error('[PWAUtils] Error capturing photo:', error);
      throw error;
    }
  }
  
  /**
   * Get user location
   */
  async getCurrentLocation(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: options.enableHighAccuracy || false,
          timeout: options.timeout || 15000,
          maximumAge: options.maximumAge || 300000
        }
      );
    });
  }
  
  // =============================================================================
  // VIBRATION
  // =============================================================================
  
  /**
   * Vibrate device
   */
  vibrate(pattern = 200) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
      return true;
    }
    return false;
  }
  
  /**
   * Haptic feedback patterns
   */
  hapticFeedback(type = 'light') {
    const patterns = {
      light: 50,
      medium: 100,
      heavy: 200,
      success: [100, 50, 100],
      error: [200, 100, 200, 100, 200],
      warning: [100, 50, 100, 50, 100]
    };
    
    return this.vibrate(patterns[type] || patterns.light);
  }
  
  // =============================================================================
  // FULLSCREEN
  // =============================================================================
  
  /**
   * Enter fullscreen mode
   */
  async enterFullscreen(element = document.documentElement) {
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      return true;
    } catch (error) {
      console.error('[PWAUtils] Error entering fullscreen:', error);
      return false;
    }
  }
  
  /**
   * Exit fullscreen mode
   */
  async exitFullscreen() {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
      return true;
    } catch (error) {
      console.error('[PWAUtils] Error exiting fullscreen:', error);
      return false;
    }
  }
  
  /**
   * Check if in fullscreen mode
   */
  isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.mozFullScreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );
  }
  
  // =============================================================================
  // WAKE LOCK
  // =============================================================================
  
  /**
   * Request screen wake lock
   */
  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        const wakeLock = await navigator.wakeLock.request('screen');
        console.log('[PWAUtils] Wake lock acquired');
        return wakeLock;
      }
      return null;
    } catch (error) {
      console.error('[PWAUtils] Error requesting wake lock:', error);
      return null;
    }
  }
  
  // =============================================================================
  // SHARE API
  // =============================================================================
  
  /**
   * Share content using Web Share API
   */
  async shareContent(data) {
    try {
      if (navigator.share) {
        await navigator.share(data);
        return { success: true };
      } else {
        // Fallback to clipboard
        if (data.url && navigator.clipboard) {
          await navigator.clipboard.writeText(data.url);
          return { success: true, method: 'clipboard' };
        }
        return { success: false, reason: 'not_supported' };
      }
    } catch (error) {
      console.error('[PWAUtils] Error sharing content:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global instance
const pwaUtils = new PWAUtils();

// Export for use in other modules
export default pwaUtils;