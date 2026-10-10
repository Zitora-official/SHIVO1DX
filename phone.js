
async function executePhoneCommand(command) {
    if (!window.Shivoid?.http?.post) {
        throw new Error("SHI.VOID Android HTTP bridge is unavailable.");
    }

    const response = await window.Shivoid.http.post(
        "YOUR_AUTOMATE_HTTP_ENDPOINT",
        {
            action: command.action,
            parameters: command.parameters || {}
        }
    );

    console.log("Automate response:", response);
    return response;
}
