
let appPackagesCache = null;

async function getAppPackages() {
    if (!appPackagesCache) {
        appPackagesCache = fetch("./appPkg.json")
            .then(response => {
                if (!response.ok) {
                    throw new Error(
                        `Failed to load appPkg.json: ${response.status}`
                    );
                }
                return response.json();
            })
            .catch(error => {
                appPackagesCache = null;
                throw error;
            });
    }

    return appPackagesCache;
}

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
        const appName = command.parameters?.app_name?.trim();

        if (!appName) {
            throw new Error("Missing app_name for open_app.");
        }

        const apps = await getAppPackages();

        // Match app names without worrying about capitalization.
        const match = Object.entries(apps).find(
            ([name]) => name.toLowerCase() === appName.toLowerCase()
        );

        if (!match) {
            throw new Error(
                `App '${appName}' was not found in appPkg.json.`
            );
        }

        const packageName = match[1];

        // Refuse incomplete package names.
        if (
            typeof packageName !== "string" ||
            !packageName.trim() ||
            packageName.includes("...")
        ) {
            throw new Error(
                `Package name for '${appName}' is missing or incomplete in appPkg.json.`
            );
        }

        const result = await shivoid.http.automate(
            "http://127.0.0.1:8001/open_app",
            {
                id: command.id,
                device: "phone",
                action: "open_app",
                parameters: {
                    app_name: appName,
                    package_name: packageName
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
