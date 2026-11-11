const { execSync } = require('child_process');
// Use CDP or run with a script tag to log computed styles
const html = `
<script>
window.addEventListener('load', () => {
  setTimeout(() => {
    const el = document.getElementById('page-config');
    const deck = document.querySelector('.config-deck');
    console.log('CONFIG_DISPLAY:', window.getComputedStyle(el).display);
    console.log('CONFIG_OPACITY:', window.getComputedStyle(el).opacity);
    console.log('CONFIG_BOUNDS:', JSON.stringify(el.getBoundingClientRect()));
    console.log('DECK_OPACITY:', window.getComputedStyle(deck).opacity);
    console.log('DECK_BOUNDS:', JSON.stringify(deck.getBoundingClientRect()));
  }, 500);
});
</script>
`;
console.log('Testing...');
