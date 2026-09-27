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

// Initialize the HUMBLE console in the prove-live hero
async function initHumbleConsole() {
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
  await mountHumbleConsole(consoleContainer, {
    reel: acmeReel,
    demoMachine: demoMachine,
    onComplete: () => {
      console.log('HUMBLE console onboarding complete');
    }
  });
}

// Lazy-mount when hero enters viewport
const heroSection = document.querySelector('.hero-full');
if (heroSection) {
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