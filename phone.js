
async function executePhoneCommand(command) {
    const shivoid = window.Shivoid || window.shivoid;

    if (!shivoid?.http?.automate) {
        throw new Error("SHI.VOID Android bridge is unavailable.");
    }

    if (!command?.id || !command?.action) {
        throw new Error("Invalid phone command.");
    }

    // Dedicated execution endpoint for opening apps.
    if (command.action === "open_app") {
        const appName = command.parameters?.app_name;

        if (!appName || typeof appName !== "string") {
            throw new Error("Missing app_name for open_app command.");
        }

        const result = await shivoid.http.automate(
            "http://127.0.0.1:8001/open_app",
            {
                id: command.id,
                device: "phone",
                action: "open_app",
                parameters: {
                    app_name: appName
                }
            }
        );

        if (result?.status !== "success") {
            throw new Error(
                result?.message ||
                result?.error ||
                `Failed to open ${appName}.`
            );
        }

        return result;
    }

    // Other actions remain unimplemented here for now.
    throw new Error(
        `No dedicated execution endpoint configured for '${command.action}'.`
    );
}
