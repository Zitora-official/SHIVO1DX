async function executePhoneCommand(command) {
    const endpoints = {
        open_app: "http://127.0.0.1:8001/open_app"
    };

    const endpoint = endpoints[command.action];

    if (!endpoint) {
        throw new Error("Unsupported phone action: " + command.action);
    }

    return await window.Shivoid.http.post(endpoint, {
        action: command.action,
        parameters: command.parameters || {}
    });
}