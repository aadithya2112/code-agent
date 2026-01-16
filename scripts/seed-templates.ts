import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function seed(templateName: string, templatePath: string) {
    console.log(`Seeding ${templateName}...`);
    
    // 1. Create Project Entry (System Project)
    // We need a way to ensure we don't duplicate.
    // Ideally we look up by title first.
    let projectId;
    const existing = await client.query(api.files.getSystemProject, { title: templateName });
    
    if (existing) {
        projectId = existing._id;
        console.log(`Updated existing project: ${projectId}`);
    } else {
        // Create System Project via internal mutation (or exposed dev mutation)
        projectId = await client.mutation(api.projects.createSystem, { title: templateName });
        console.log(`Created new system project: ${projectId}`);
    }

    // 2. Walk files
    const files = getAllFiles(templatePath);
    
    // 3. Upload
    for (const file of files) {
        const relativePath = path.relative(templatePath, file);
        const finalPath = "/" + relativePath; // Standardize to /src/App.tsx
        
        const isBinary = /\.(ico|png|jpg|jpeg|gif|woff|woff2|ttf|eot)$/i.test(file);

        if (isBinary) {
            console.log(`Skipping binary file (and deleting if exists): ${finalPath}`);
            await client.mutation(api.files.deleteFile, {
                projectId,
                path: finalPath
            });
            continue;
        }

        const content = fs.readFileSync(file, "utf-8");
        
        await client.mutation(api.files.saveSystemTemplate, {
            projectId,
            path: finalPath,
            content
        });
        console.log(`Saved: ${finalPath}`);
    }
    
    console.log(`Done seeding ${templateName}`);
}

function getAllFiles(dir: string, fileList: string[] = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            if (file !== "node_modules" && file !== ".git" && file !== ".next") {
                 getAllFiles(filePath, fileList);
            }
        } else {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

// EXECUTION
const TEMPLATES_DIR = path.join(process.cwd(), "templates");
seed("React Template", path.join(TEMPLATES_DIR, "react"));
seed("Next.js Template", path.join(TEMPLATES_DIR, "nextjs"));
