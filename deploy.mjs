import { KomodoClient } from "komodo_client";
import dotenv from "dotenv";
import { readFileSync } from "fs";

// Load environment variables from .env file
dotenv.config();

// Parse docker.env file for environment variables used within the Komodo build and deployment steps
const dockerEnvVars = Object.entries(dotenv.parse(readFileSync("docker.env", "utf8"))).map(([variable, value]) => ({
    variable,
    value,
}));

// Parse command line arguments
const args = process.argv.slice(2);
const branchFromArgs = args[0]; // First argument is the branch name

// Use the original base URL approach that worked before
console.log(`🔧 Using base URL for client: ${process.env.KOMODO_URL}`);

const komodo = KomodoClient(process.env.KOMODO_URL, {
    type: "api-key",
    params: {
        key: process.env.KOMODO_API_KEY,
        secret: process.env.KOMODO_API_SECRET,
    },
});

const deploymentType = process.env.DEPLOYMENT_TYPE || "deployment";
const baseName = process.env.DOCKER_IMAGEBASENAME;
const branchName = branchFromArgs || process.env.BRANCH_NAME || "dev";
const repoName = process.env.REPO_NAME;
const serverIdDeploy = process.env.KOMODO_SERVER_ID_DEPLOY;
const serverIdBuild = process.env.KOMODO_SERVER_ID_BUILD;
const builderId = process.env.KOMODO_BUILDER_ID;
const dockerImage = process.env.DOCKER_IMAGE;
const dockerBuildArgs = dockerEnvVars.map((env) => `${env.variable}=${env.value}`).join(" ");
const dockerRegistry = process.env.DOCKER_REGISTRY;
const dockerUsername = process.env.DOCKER_USERNAME;
const gitAccount = process.env.GIT_ACCOUNT;
const buildImage = process.env.BUILD_IMAGE === "true" || args.includes("--build");
const pangolinDomain = process.env.PANGOLIN_DOMAIN_ID;

console.log(`📦 Loaded ${dockerEnvVars.length} environment variables from docker.env`);

// Function to generate YAML environment section
function generateYamlEnvSection(envVars, branchName) {
    let yamlEnv = "";
    envVars.forEach((env) => {
        yamlEnv += `      ${env.variable}: ${env.value}\n`;
    });
    yamlEnv += `      BRANCH: ${branchName}`;
    return yamlEnv;
}

if (branchFromArgs) {
    console.log(`🌿 Using branch from command line: ${branchFromArgs}`);
} else {
    console.log(`🌿 Using branch from .env or default: ${branchName}`);
}

console.log(`📋 Configuration:`);
console.log(`   Deployment Type: ${deploymentType}`);
console.log(`   Base Name: ${baseName}`);
console.log(`   Branch Name: ${branchName}`);
console.log(`   Repo Name: ${repoName}`);
console.log(`   Server ID Deploy: ${serverIdDeploy || "NOT SET"}`);
console.log(`   Server ID Build: ${serverIdBuild || "NOT SET"}`);
console.log(`   Builder ID: ${builderId}`);
console.log(`   Docker Registry: ${dockerRegistry}`);
console.log(`   Docker Username: ${dockerUsername}`);
console.log(`   Git Account: ${gitAccount}`);
console.log(`   Build Image: ${buildImage ? "YES" : "NO"}`);

// Validate required environment variables
if (!process.env.KOMODO_URL) {
    console.error("❌ KOMODO_URL is required in .env file");
    process.exit(1);
}
if (!process.env.KOMODO_API_KEY) {
    console.error("❌ KOMODO_API_KEY is required in .env file");
    process.exit(1);
}
if (!process.env.KOMODO_API_SECRET) {
    console.error("❌ KOMODO_API_SECRET is required in .env file");
    process.exit(1);
}

// Create branch-specific names
const branchSuffix = branchName.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
const stackName = `${baseName}-${branchSuffix}`;
const deploymentName = `${baseName}-${branchSuffix}`;

// Create Docker-safe tag (lowercase, no special chars except dash)
const dockerTag = branchName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^[-]+|[-]+$/g, "")
    .replace(/[-]+/g, "-");

// Generate predictable port based on branch name hash
const branchHash = branchSuffix.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
}, 0);
const hostPort = 3000 + Math.abs(branchHash % 1000);

console.log(`   Generated Stack Name: ${stackName}`);
console.log(`   Generated Host Port: ${hostPort}`);
console.log(`   Generated Deployment Name: ${deploymentName}`);
console.log(`   Generated Docker Tag: ${dockerTag}`);

// Helper function to write deployment info with fallback
async function writeDeploymentInfo(deploymentInfo, isFailure = false) {
    const { writeFileSync, existsSync } = await import("fs");
    const { dirname } = await import("path");
    const filePath = "/app/workspace/deployment-info.json";
    
    // Check if base folder exists, if not write to current directory
    const baseDir = dirname(filePath);
    let finalFilePath = filePath;
    
    try {
        if (!existsSync(baseDir)) {
            console.log(`📁 Base directory ${baseDir} doesn't exist, writing to current directory instead`);
            finalFilePath = "deployment-info.json";
        }
    } catch (error) {
        console.log(`📁 Cannot access ${baseDir}, writing to current directory instead`);
        finalFilePath = "deployment-info.json";
    }

    const infoType = isFailure ? "failure" : "";
    console.log(`📄 Writing deployment ${infoType} info to: ${finalFilePath}`);
    console.log(`📄 Deployment ${infoType} info content:`, JSON.stringify(deploymentInfo, null, 2));

    writeFileSync(finalFilePath, JSON.stringify(deploymentInfo, null, 2));

    // Verify file was written
    if (existsSync(finalFilePath)) {
        console.log(`✅ Deployment ${infoType} info file created successfully at ${finalFilePath}`);
    } else {
        console.log(`❌ Failed to create deployment ${infoType} info file at ${finalFilePath}`);
    }
}

try {
    console.log(`🔗 Testing connection to Komodo server: ${process.env.KOMODO_URL}`);
    console.log(`🔑 Using API key: ${process.env.KOMODO_API_KEY?.substring(0, 8)}...`);

    // Test if the issue is recent by checking what endpoint the client constructs
    console.log(`🔧 Komodo client will construct API endpoint from base URL internally`);
    console.log(`🔧 Let's see what happens with the original working approach...`);

    // Intercept and log actual requests
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
        console.log(`🌐 Komodo client making request to: ${url}`);
        console.log(`🌐 Request method: ${options?.method || "GET"}`);
        console.log(`🌐 Request headers:`, JSON.stringify(options?.headers || {}, null, 2));

        const response = await originalFetch(url, options);
        console.log(`🌐 Response status: ${response.status}`);

        // Clone response to peek at content
        const clonedResponse = response.clone();
        const text = await clonedResponse.text();
        console.log(`🌐 Response preview: ${text.substring(0, 200)}...`);

        return response;
    };

    console.log(`📋 Connecting to Komodo client...`);
    console.log(`🔧 Attempting to call ListStacks API...`);

    // Add more detailed error handling
    let stacks;
    try {
        stacks = await komodo.read("ListStacks", {});
        console.log(`✅ Connected! Found ${stacks.length} stacks`);
    } catch (apiError) {
        console.error(`❌ API Error details:`, {
            status: apiError.status,
            message: apiError.message,
            stack: apiError.stack,
        });
        throw apiError;
    } finally {
        // Restore original fetch
        global.fetch = originalFetch;
    }

    // Build Docker image if requested
    if (buildImage) {
        console.log(`🔨 Building Docker image for branch: ${branchName}`);

        // Use existing builder (no need for branch-specific builders now that tagging works)
        console.log(`🔍 Checking available builders...`);
        const builders = await komodo.read("ListBuilders", {});
        console.log(`📋 Found ${builders.length} builders:`);
        builders.forEach((builder) => {
            console.log(`   - ${builder.name} (${builder.id})`);
        });

        // Auto-generate builder name from server ID only
        const expectedBuilderName = `${serverIdBuild}_builder`;
        console.log(`🔍 Looking for builder: ${expectedBuilderName}`);

        // Find builder by name pattern or create it
        let availableBuilder = builders.find((b) => b.name === expectedBuilderName);

        if (!availableBuilder) {
            console.log(`🏗️  Creating builder: ${expectedBuilderName}`);
            const newBuilder = await komodo.write("CreateBuilder", {
                name: expectedBuilderName,
                config: {
                    type: "Server",
                    params: {
                        server_id: serverIdBuild,
                    },
                },
            });
            availableBuilder = newBuilder;
            console.log(`✅ Builder created: ${expectedBuilderName}`);
        } else {
            console.log(`📦 Found existing builder: ${expectedBuilderName}`);
        }

        const actualBuilderId = availableBuilder.id || availableBuilder._id?.$oid || availableBuilder._id;
        console.log(`🔧 Using builder: ${expectedBuilderName} (${actualBuilderId})`);

        // Check if a build exists for this repo
        const builds = await komodo.read("ListBuilds", {});
        const buildName = `${baseName}-build-${branchSuffix}`;
        let buildId = null;

        const existingBuild = builds.find((b) => b.name === buildName);
        if (existingBuild) {
            buildId = existingBuild.id;
            console.log(`📦 Found existing build: ${buildName} - reusing existing build`);

            // Update the existing build configuration to ensure it's current
            console.log(`🔄 Updating build configuration...`);
            await komodo.write("UpdateBuild", {
                id: buildId,
                config: {
                    server_id: serverIdBuild,
                    builder_id: actualBuilderId,
                    repo: repoName?.includes("/") ? repoName : `${gitAccount}/${repoName}`,
                    branch: branchName,
                    git_provider: "github.com",
                    git_https: true,
                    git_account: repoName?.includes("/") ? repoName.split("/")[0] : gitAccount,
                    dockerfile_path: dockerImage,
                    docker_build_args: `BRANCH=${branchName} ${dockerBuildArgs}`,
                    image_registry: {
                        domain: dockerRegistry,
                        account: dockerUsername,
                    },
                    image_name: `${baseName}`,
                    image_tag: `${dockerTag}`,
                },
            });
            console.log(`✅ Build configuration updated`);
        } else {
            // Create new build only if it doesn't exist
            console.log(`🏗️  Creating new build: ${buildName}`);
            const newBuild = await komodo.write("CreateBuild", {
                name: buildName,
                config: {
                    server_id: serverIdBuild,
                    builder_id: actualBuilderId,
                    repo: repoName?.includes("/") ? repoName : `${gitAccount}/${repoName}`,
                    branch: branchName,
                    git_provider: "github.com",
                    git_https: true,
                    git_account: repoName?.includes("/") ? repoName.split("/")[0] : gitAccount,
                    dockerfile_path: dockerImage,
                    docker_build_args: `BRANCH=${branchName} ${dockerBuildArgs}`,
                    image_registry: {
                        domain: dockerRegistry,
                        account: dockerUsername,
                    },
                    image_name: `${baseName}`,
                    image_tag: `${dockerTag}`,
                },
            });
            buildId = newBuild._id;
            console.log(`✅ Build created with ID: ${buildId}`);
        }

        // Trigger the build
        console.log(`🚀 Starting build for ${baseName}:${dockerTag}...`);
        const buildUpdate = await komodo.execute("RunBuild", { build: buildName });
        console.log(`✅ Build started: ${buildUpdate.id}`);

        console.log(`⏳ Waiting for build to complete... (this may take a few minutes)`);

        // Poll for build completion
        let buildComplete = false;
        let attempts = 0;
        const maxAttempts = 20; // 10 minutes max

        while (!buildComplete && attempts < maxAttempts) {
            attempts++;
            console.log(`📋 Checking build status (attempt ${attempts}/${maxAttempts})...`);

            try {
                const builds = await komodo.read("ListBuilds", {});
                const currentBuild = builds.find((b) => b.name === buildName);

                if (currentBuild && currentBuild.info && currentBuild.info.state) {
                    const state = currentBuild.info.state;
                    console.log(`📊 Build state: ${state}`);

                    if (state === "complete" || state === "success" || state === "Ok") {
                        console.log(`✅ Build completed successfully!`);
                        buildComplete = true;
                    } else if (state === "failed" || state === "error") {
                        console.error(`❌ Build failed with state: ${state}`);
                        throw new Error(`Build failed with state: ${state}`);
                    } else {
                        console.log(`⏳ Build still running... waiting 30 seconds`);
                        await new Promise((resolve) => setTimeout(resolve, 30000));
                    }
                } else {
                    console.log(`⏳ Build state unknown... waiting 30 seconds`);
                    await new Promise((resolve) => setTimeout(resolve, 30000));
                }
            } catch (error) {
                console.error(`❌ Error checking build status:`, error.message);
                if (attempts >= maxAttempts) {
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, 30000));
            }
        }

        if (!buildComplete) {
            throw new Error(`Build did not complete within ${(maxAttempts * 30) / 60} minutes`);
        }

        console.log(
            `✅ Build completed! Will use exact tag: ${dockerRegistry}/${dockerUsername}/${baseName}:latest-${dockerTag}`
        );
    }

    if (deploymentType === "deployment") {
        console.log(`📋 Checking for existing deployment '${deploymentName}'...`);

        const deployments = await komodo.read("ListDeployments", {});
        const existingDeployment = deployments.find((d) => d.name === deploymentName);

        if (existingDeployment) {
            console.log(`🔄 Updating existing deployment: ${deploymentName} on port ${hostPort}`);

            // Stop and remove the existing deployment first to free up the port and name
            console.log(`🛑 Stopping existing deployment to free up port ${hostPort}...`);
            try {
                await komodo.execute("StopDeployment", { deployment: deploymentName });
                console.log(`✅ Existing deployment stopped`);

                // Wait a moment for the container to fully stop
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Remove the stopped container to free up the name
                console.log(`🗑️ Removing stopped container to free up name...`);
                await komodo.execute("RemoveDeployment", { deployment: deploymentName });
                console.log(`✅ Existing deployment removed`);

                // Wait a moment for cleanup
                await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (error) {
                console.log(`⚠️ Failed to stop/remove existing deployment: ${error.message}`);
            }

            await komodo.write("UpdateDeployment", {
                id: existingDeployment.id,
                config: {
                    server_id: serverIdDeploy,
                    image: {
                        type: "Image",
                        params: {
                            image: `${dockerRegistry}/${dockerUsername}/${baseName}:latest-${dockerTag}`,
                        },
                    },
                    network: "bridge",
                    ports: [
                        {
                            local: `${hostPort}`,
                            container: "3000",
                            protocol: "tcp",
                            bind_ip: "127.0.0.1",
                        },
                    ],
                    environment: [...dockerEnvVars, { variable: "BRANCH", value: branchName }],
                    restart: "unless-stopped",
                },
            });
            console.log(`✅ Deployment updated: ${deploymentName}`);

            // Deploy the updated deployment
            console.log(`🚀 Starting deployment...`);
            const deployUpdate = await komodo.execute("Deploy", { deployment: deploymentName });
            console.log(`✅ Deployment started: ${deployUpdate.id}`);
        } else {
            console.log(`🏗️  Creating new deployment: ${deploymentName} on port ${hostPort}`);
            const newDeployment = await komodo.write("CreateDeployment", {
                name: deploymentName,
                config: {
                    server_id: serverIdDeploy,
                    image: {
                        type: "Image",
                        params: {
                            image: `${dockerRegistry}/${dockerUsername}/${baseName}:latest-${dockerTag}`,
                        },
                    },
                    network: "bridge",
                    ports: [
                        {
                            local: `${hostPort}`,
                            container: "3000",
                            protocol: "tcp",
                            bind_ip: "127.0.0.1",
                        },
                    ],
                    environment: [...dockerEnvVars, { variable: "BRANCH", value: branchName }],
                    restart: "unless-stopped",
                },
            });
            console.log(`✅ Deployment created with ID: ${newDeployment._id}`);

            // Deploy the new deployment
            console.log(`🚀 Starting deployment...`);
            const deployUpdate = await komodo.execute("Deploy", { deployment: deploymentName });
            console.log(`✅ Deployment started: ${deployUpdate.id}`);

            // Wait a moment and check deployment status
            console.log(`⏳ Waiting 10 seconds to check deployment status...`);
            await new Promise((resolve) => setTimeout(resolve, 10000));

            try {
                const deployments = await komodo.read("ListDeployments", {});
                const currentDeployment = deployments.find((d) => d.name === deploymentName);
                if (currentDeployment && currentDeployment.info) {
                    console.log(`📊 Deployment status: ${currentDeployment.info.state || "unknown"}`);
                    if (currentDeployment.info.state === "running") {
                        console.log(`✅ Container is running successfully`);
                    } else {
                        console.log(`⚠️  Container state: ${currentDeployment.info.state}`);
                        console.log(`💡 Troubleshooting tips:`);
                        console.log(`   - Check container logs: docker logs ${deploymentName}`);
                        console.log(
                            `   - Inspect image contents: docker run --rm -it ${dockerRegistry}/${dockerUsername}/${baseName}:latest-${dockerTag} sh`
                        );
                        console.log(
                            `   - Check if build files exist: docker run --rm ${dockerRegistry}/${dockerUsername}/${baseName}:latest-${dockerTag} ls -la build/`
                        );
                        console.log(
                            `   - Verify image exists: docker pull ${dockerRegistry}/${dockerUsername}/${baseName}:latest-${dockerTag}`
                        );
                    }
                }
            } catch (error) {
                console.log(`⚠️  Could not check deployment status: ${error.message}`);
            }
        }

        console.log(`🌐 Deployment info:`);
        console.log(`   Branch: ${branchName}`);
        console.log(`   Image: ${dockerRegistry}/${dockerUsername}/${baseName}:latest-${dockerTag}`);
        console.log(`   Port: ${hostPort}`);
        console.log(`   Server ID: ${serverIdDeploy}`);
        console.log(`   Deployment Name: ${deploymentName}`);
        console.log(`   Access URL: https://${hostPort}.${pangolinDomain}`);
    } else if (deploymentType === "stack" || deploymentType === "repo-then-stack") {
        console.log(`📋 Checking if stack '${stackName}' exists...`);

        // Check if stack already exists and delete it to recreate with correct image path
        const existingStack = stacks.find((s) => s.name === stackName);

        if (existingStack) {
            console.log(`🗑️  Deleting existing stack to recreate with correct image path...`);
            await komodo.write("DeleteStack", { id: existingStack.id });
            console.log(`✅ Stack deleted, will recreate`);
        }

        // Create stack (always create since we delete existing ones)
        {
            console.log(`🏗️  Creating new stack: ${stackName}`);
            const newStack = await komodo.write("CreateStack", {
                name: stackName,
                config: {
                    server_id: serverIdDeploy,
                    project_name: stackName,
                    file_contents: `services:
  ${stackName}:
    container_name: ${stackName}
    image: ${dockerRegistry}/${dockerUsername}/${baseName}:latest-${dockerTag}
    restart: unless-stopped
    ports:
      - '127.0.0.1:${hostPort}:3000'
    environment:
${generateYamlEnvSection(dockerEnvVars, branchName)}`,
                    environment:
                        dockerEnvVars.map((env) => `${env.variable}=${env.value}`).join("\n") +
                        `\nBRANCH=${branchName}`,
                },
            });
            console.log(`✅ Stack created with ID: ${newStack._id}`);
        }

        // Deploy repository if specified
        if (repoName && (deploymentType === "repo-then-stack" || deploymentType === "repo")) {
            console.log(`📦 Pulling repository: ${repoName}`);
            const pullUpdate = await komodo.execute("PullRepo", { repo: repoName });
            console.log(`✅ Repository pull initiated: ${pullUpdate.id}`);
        }

        // Deploy the stack
        console.log(`🚀 Deploying stack: ${stackName}`);
        const deployUpdate = await komodo.execute("DeployStack", { stack: stackName });
        console.log(`✅ Stack deployment initiated: ${deployUpdate.id}`);
    }

    if (deploymentType === "container") {
        console.log(`📋 Checking if deployment '${deploymentName}' exists...`);

        // Check if deployment already exists
        const deployments = await komodo.read("ListDeployments", {});
        const existingDeployment = deployments.find((d) => d.name === deploymentName);

        if (!existingDeployment) {
            console.log(`🏗️  Creating new deployment: ${deploymentName}`);
            const newDeployment = await komodo.write("CreateDeployment", {
                name: deploymentName,
                config: {
                    server_id: serverIdDeploy,
                    image: {
                        type: "Image",
                        params: { image: `${baseName}:${branchName}` },
                    },
                    network: "host",
                    restart: "unless-stopped",
                    environment: `BRANCH=${branchName}\nNODE_ENV=development\nPORT=3001`,
                    ports: "3001:3000",
                    auto_update: true,
                    poll_for_updates: true,
                },
            });
            console.log(`✅ Deployment created with ID: ${newDeployment._id}`);
        } else {
            console.log(`📦 Deployment '${deploymentName}' already exists`);
        }

        // Deploy the container
        console.log(`🚀 Deploying container: ${deploymentName}`);
        const deployUpdate = await komodo.execute("Deploy", { deployment: deploymentName });
        console.log(`✅ Container deployment initiated: ${deployUpdate.id}`);
    }

    console.log(`🎉 Deployment completed successfully!`);
    console.log(`📝 Resource name: ${deploymentType === "container" ? deploymentName : stackName}`);

    // Write deployment info for GitHub Actions to read
    const deploymentInfo = {
        success: true,
        branch: branchName,
        hostPort: hostPort,
        resourceName: deploymentType === "container" ? deploymentName : stackName,
        imageTag: dockerTag,
        deploymentType: deploymentType,
    };

    // Write deployment info for GitHub Actions to read
    await writeDeploymentInfo(deploymentInfo);
} catch (error) {
    console.error(`❌ Deployment failed:`, error);
    console.error(`Error details:`, error.response?.data || error.message);

    // Write failure info for GitHub Actions to read
    const deploymentInfo = {
        success: false,
        branch: branchName || "unknown",
        error: error.message || "Unknown error",
        deploymentType: deploymentType || "unknown",
    };

    // Write failure info for GitHub Actions to read
    try {
        await writeDeploymentInfo(deploymentInfo, true);
    } catch (writeError) {
        console.error(`Failed to write deployment info: ${writeError.message}`);
    }

    process.exit(1);
}
