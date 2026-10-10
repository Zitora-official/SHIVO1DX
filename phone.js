
async function executePhoneCommand(command) {
    const shivoid = window.Shivoid || window.shivoid;

    if (!shivoid?.http?.automate) {
        throw new Error("SHI.VOID Android bridge is unavailable.");
    }

    if (!command?.id || !command?.action) {
        throw new Error("Invalid phone command.");
    }

    const result = await shivoid.http.automate(
        "http://127.0.0.1:8080/task",
        command
    );

    if (!result || result.status !== "success") {
        throw new Error(
            result?.message ||
            result?.error ||
            "Phone command execution failed."
        );
    }

    return result;
}
