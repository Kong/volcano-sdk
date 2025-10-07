#!/usr/bin/env node

/**
 * Node.js script for deploying to S3
 * Alternative to bash script for cross-platform compatibility
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

// Helper functions
const log = {
  info: (msg) => console.log(`${colors.green}[INFO]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warning: (msg) =>
    console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
};

// Execute command and return output
const exec = (command, options = {}) => {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: "inherit",
      ...options,
    });
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
};

// Check if remote backend is configured
const hasRemoteBackend = () => {
  try {
    const backendFile = fs.readFileSync(
      path.join(process.cwd(), "terraform", "backend.tf"),
      "utf8"
    );
    return (
      backendFile.includes('backend "s3"') &&
      !backendFile.match(/^\s*#.*backend "s3"/m)
    );
  } catch {
    return false;
  }
};

// Get Terraform output
const getTerraformOutput = (outputName) => {
  try {
    // Check and sync remote state if needed
    if (hasRemoteBackend()) {
      log.info("Remote backend detected. Syncing state...");
      try {
        execSync("cd terraform && terraform init -reconfigure", {
          stdio: "pipe",
        });
        execSync("cd terraform && terraform refresh", { stdio: "pipe" });
      } catch (refreshError) {
        log.warning("Could not refresh state, continuing with cached state...");
      }
    }

    const result = execSync(
      `cd terraform && terraform output -raw ${outputName}`,
      {
        encoding: "utf8",
        stdio: "pipe",
      }
    );
    return result.trim();
  } catch (error) {
    throw new Error(
      `Failed to get Terraform output '${outputName}': ${error.message}`
    );
  }
};

// Main deployment function
const deploy = async () => {
  try {
    // Check if dist directory exists
    const distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) {
      log.error(
        "dist directory not found. Please build the application first."
      );
      process.exit(1);
    }

    // Get deployment configuration from Terraform
    log.info("Getting deployment configuration from Terraform...");
    const s3Bucket = getTerraformOutput("s3_bucket_name");
    const cloudfrontId = getTerraformOutput("cloudfront_distribution_id");
    const websiteUrl = getTerraformOutput("website_url");

    // Upload files to S3
    log.info(`Uploading files to S3 bucket: ${s3Bucket}`);

    // Upload assets with long cache
    exec(
      `aws s3 sync dist/ s3://${s3Bucket}/ --delete ` +
        `--cache-control "public, max-age=31536000" ` +
        `--exclude "*.html" --exclude "*.json"`
    );

    // Upload HTML and JSON files with no cache
    exec(
      `aws s3 sync dist/ s3://${s3Bucket}/ --delete ` +
        `--cache-control "public, max-age=0, must-revalidate" ` +
        `--exclude "*" --include "*.html" --include "*.json"`
    );

    log.info("Files uploaded successfully!");

    // Create CloudFront invalidation
    log.info("Creating CloudFront invalidation...");
    const invalidationResult = execSync(
      `aws cloudfront create-invalidation --distribution-id ${cloudfrontId} --paths "/*" --query 'Invalidation.Id' --output text`,
      { encoding: "utf8" }
    ).trim();

    log.info(`CloudFront invalidation created: ${invalidationResult}`);

    // Success message
    console.log("\n" + "=".repeat(50));
    console.log(
      `${colors.green}Deployment completed successfully!${colors.reset}`
    );
    console.log("=".repeat(50));
    console.log(`Website URL: ${websiteUrl}`);
    console.log(`S3 Bucket: ${s3Bucket}`);
    console.log(`CloudFront Distribution ID: ${cloudfrontId}`);
    console.log("=".repeat(50));
  } catch (error) {
    log.error(error.message);
    process.exit(1);
  }
};

// Run deployment
deploy();
