
async function executePhoneCommand(command) {
    if (!window.Shivoid?.http?.automate) {
        throw new Error("SHI.VOID Automate bridge is unavailable.");
    }

    const endpoints = {
        open_app: "http://127.0.0.1:8001/open_app"
    };

    const endpoint = endpoints[command.action];

    if (!endpoint) {
        throw new Error("Unsupported phone action: " + command.action);
    }

    const response = await window.Shivoid.http.automate(
        endpoint,
        {
            action: command.action,
            parameters: command.parameters || {}
        }
    );

    console.log("Automate response:", response);
    return response;
}
