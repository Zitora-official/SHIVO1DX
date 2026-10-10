
async function executePhoneCommand(command) {
    const response = await window.Shivoid.http.post(
        "YOUR_AUTOMATE_HTTP_ENDPOINT",
        {
            action: command.action,
            parameters: command.parameters || {}
        }
    );

    return response;
}
