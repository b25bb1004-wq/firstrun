import { mountHumbleConsole } from '/humble-console/console.js';

// Load reel data
async function loadReel(name) {
  try {
    const resp = await fetch('/data/reels/' + name + '.json');
    if (resp.ok) return await resp.json();
  } catch (e) {}
  return null;
}

async function loadDemoMachine() {
  try {
    const resp = await fetch('/data/reels/demo-machine.json');
    if (resp.ok) return await resp.json();
  } catch (e) {}
  return null;
}

let initialized = false;

// Initialize the HUMBLE console in the prove-live hero
export async function initHumbleConsole() {
  if (initialized) return window.humbleConsole;
  initialized = true;
  
  const consoleContainer = document.getElementById('humble-console-mount');
  if (!consoleContainer) return;
  
  // Load data
  const [acmeReel, demoMachine] = await Promise.all([
    loadReel('acme-shop'),
    loadDemoMachine()
  ]);
  
  if (!acmeReel) {
    console.warn('Could not load acme-shop reel');
    return;
  }
  
  // Mount the console
  const consoleInstance = await mountHumbleConsole(consoleContainer, {
    reel: acmeReel,
    demoMachine: demoMachine,
    onComplete: () => {
      console.log('HUMBLE console onboarding complete');
    }
  });
  window.humbleConsole = consoleInstance;
  return consoleInstance;
}

// Lazy-mount when hero enters viewport
const heroSection = document.querySelector('.hero-full');
if (heroSection) {
  const checkMount = () => {
    const rect = heroSection.getBoundingClientRect();
    if (rect.top < window.innerHeight + 300 && rect.bottom > -300) {
      initHumbleConsole();
    }
  };
  
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          observer.disconnect();
          initHumbleConsole();
        }
      });
    }, { rootMargin: '200px' });
    observer.observe(heroSection);
  }
  
  // Immediate check in case already in viewport or observer delayed
  checkMount();
}