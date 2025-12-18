async function main() {
  try {
    const response = await fetch('http://127.0.0.1:8000/list-apps');
    const apps = await response.json();
    console.log('ADK Apps:', apps);
  } catch (err) {
    console.error('Failed to list apps:', err);
  }
}

main();
