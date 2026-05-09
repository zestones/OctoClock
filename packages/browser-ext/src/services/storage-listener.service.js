export function addStorageListener(key, callback) {
    const listener = (changes, area) => {
        if (area === 'local' && changes[key]) {
            callback(changes[key].newValue);
        }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
}
