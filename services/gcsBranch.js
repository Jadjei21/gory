const { Storage } = require('@google-cloud/storage');
const path = require('path');
const crypto = require('crypto');
const { log } = require('console');
require('dotenv').config();

const storage = new Storage({
  keyFilename: path.join(__dirname, '..', 'gory-server-1c683176a315.json'),
  projectId: process.env.GCLOUD_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
async function createBranch(repoName, branchName) {
  const basePath = `repos/${repoName}/`;
  const repoFile = bucket.file(`${basePath}repo.json`);
  const newBranchFile = bucket.file(`${basePath}branches/${branchName}_repo.json`);

  // Load and parse repo.json
  const [repoRaw] = await repoFile.download();
  const repo = JSON.parse(repoRaw.toString());

  // Check if branch already exists
  if (repo.branches.includes(branchName)) {
    throw new Error('Branch already exists');
  }

  const currentBranch = repo.current_branch;
  const parentBranchFile = bucket.file(`${basePath}branches/${currentBranch}_repo.json`);
  const fromWorkspace = bucket.file(`${basePath}branches/${currentBranch}/workspace/`);
const toWorkspace = `${basePath}branches/${branchName}/workspace/`;

const [files] = await bucket.getFiles({ prefix: `${fromWorkspace.name}` });

await Promise.all(
  files.map(file => {
    const destPath = file.name.replace(fromWorkspace.name, toWorkspace);
    return file.copy(bucket.file(destPath));
  })
);

  // Load current branch metadata
  const [parentRaw] = await parentBranchFile.download();
  const parentBranchData = JSON.parse(parentRaw.toString());

  // Create new branch with current branch's commits
  const newBranchData = {
    branch: branchName,
    commits: [...parentBranchData.commits],
    subBranches: [],
    createdAt: new Date().toISOString(),
  };

  // Save new branch file
  await newBranchFile.save(JSON.stringify(newBranchData, null, 2), {
    contentType: 'application/json',
  });

  // Update parent branch's subBranches
  if (!parentBranchData.subBranches.includes(branchName)) {
    parentBranchData.subBranches.push(branchName);

    await parentBranchFile.save(JSON.stringify(parentBranchData, null, 2), {
      contentType: 'application/json',
    });
  }

  // Update repo.json
  repo.branches.push(branchName);
  await repoFile.save(JSON.stringify(repo, null, 2), {
    contentType: 'application/json',
  });
}

async function switchBranch(repoName, targetBranch) {
  const basePath = `repos/${repoName}/`;
  const repoFile = bucket.file(`${basePath}repo.json`);
  const targetBranchFile = bucket.file(`${basePath}branches/${targetBranch}_repo.json`);

  const [repoRaw] = await repoFile.download();
  const repo = JSON.parse(repoRaw.toString());

  const currentBranch = repo.current_branch;
  if (currentBranch === targetBranch) {
    throw new Error('Already on this branch');
  }

  const currentStagingPrefix = `${basePath}staging/`;
  const currentBranchStaging = `${basePath}branches/${currentBranch}/staging/`;
  const targetBranchStaging = `${basePath}branches/${targetBranch}/staging/`;

  const listFiles = async (prefix) => {
    const [files] = await bucket.getFiles({ prefix });
    return files.filter(f => !f.name.endsWith('/.init'));
  };

  const moveFiles = async (files, fromPrefix, toPrefix) => {
    await Promise.all(files.map(async (file) => {
      const dest = file.name.replace(fromPrefix, toPrefix);
      await file.copy(bucket.file(dest));
      await file.delete();
    }));
  };

  // Move current staged files to current branch
  const stagedFiles = await listFiles(currentStagingPrefix);
  if (stagedFiles.length > 0) {
    await moveFiles(stagedFiles, currentStagingPrefix, currentBranchStaging);
  }

  // Clear current staging
  const toClear = await listFiles(currentStagingPrefix);
  await Promise.all(toClear.map(file => file.delete()));

  // Restore staging from target branch (if any)
  const targetStagedFiles = await listFiles(targetBranchStaging);
  await Promise.all(
    targetStagedFiles.map(file => {
      const dest = file.name.replace(targetBranchStaging, currentStagingPrefix);
      return file.copy(bucket.file(dest));
    })
  );
  
  // Replace commits
  const [targetRaw] = await targetBranchFile.download();
  const targetData = JSON.parse(targetRaw.toString());

  repo.commits = [...targetData.commits];
  repo.current_branch = targetBranch;

  await repoFile.save(JSON.stringify(repo, null, 2), {
    contentType: 'application/json',
  });
}
async function deleteBranch(repoName, branchName) {
  console.log('First entry')
  const basePath = `repos/${repoName}/`;
  const repoFile = bucket.file(`${basePath}repo.json`);
  const branchMetaFile = bucket.file(`${basePath}branches/${branchName}_repo.json`);
  const commitsPrefix = `${basePath}commits/`;
  const branchWorkspacePrefix = `${basePath}branches/${branchName}/workspace/`;
  const branchStagingPrefix = `${basePath}branches/${branchName}/`;
  console.log('Second entry')
  // Load and parse repo.json
  const [repoRaw] = await repoFile.download();
  const repo = JSON.parse(repoRaw.toString());

  if (repo.current_branch === branchName) {
    throw new Error('Cannot delete the current branch');
  }

  if (!repo.branches.includes(branchName)) {
    throw new Error('Branch not found in repo.json');
  }
  console.log('Third entry')
  // Load branch metadata
  const [branchRaw] = await branchMetaFile.download();
  const branchMeta = JSON.parse(branchRaw.toString());
  console.log('Fourth entry')
  // Step 1: Get all commit IDs from other branches
  const [branchFiles] = await bucket.getFiles({ prefix: `${basePath}branches/` });

  const otherCommitIds = new Set();
await Promise.all(
  branchFiles
    .filter(f => f.name.endsWith('_repo.json') && f.name !== `${basePath}branches/${branchName}_repo.json`)
    .map(async (file) => {
      const [data] = await file.download();
      const branchData = JSON.parse(data.toString());
      branchData.commits.forEach(c => otherCommitIds.add(c.id));
    })
);

  console.log('Fifth entry')
  // Step 2: Filter out unique commits
  const commitsToDelete = branchMeta.commits
    .filter(c => !otherCommitIds.has(c.id))
    .map(c => c.id);

  // Step 3: Delete unique commit files
  const [allCommitFiles] = await bucket.getFiles({ prefix: commitsPrefix });
  const filesToDelete = allCommitFiles.filter(file => {
    const commitId = file.name.split('/')[3];
    return commitsToDelete.includes(commitId);
  });

  await Promise.all(filesToDelete.map(f => f.delete()));
  console.log('Got here')
  // Step 4: Delete branch workspace
  const [workspaceFiles] = await bucket.getFiles({ prefix: branchWorkspacePrefix });
  await Promise.all(workspaceFiles.map(f => f.delete()));
  console.log('Workspace deletion')
  // Step 5: Delete branch staging folder (general)
  const [stagingFiles] = await bucket.getFiles({ prefix: branchStagingPrefix });
  await Promise.all(stagingFiles.map(f => f.delete()));

  // Step 6: Remove from repo.json
  repo.branches = repo.branches.filter(b => b !== branchName);
  await repoFile.save(JSON.stringify(repo, null, 2), {
    contentType: 'application/json',
  });
  console.log('About to reparent')
  // Step 7: Re-parent subBranches to grandparent
  const deletedSubBranches = branchMeta.subBranches || [];

  await Promise.all(
    branchFiles
      .filter(f => f.name.endsWith('_repo.json') && f.name !== `${basePath}branches/${branchName}_repo.json`)
      .map(async (file) => {
        const [raw] = await file.download();
        const branch = JSON.parse(raw.toString());
  
        if (branch.subBranches?.includes(branchName)) {
          branch.subBranches = branch.subBranches
            .filter(b => b !== branchName)
            .concat(deletedSubBranches);
  
          await file.save(JSON.stringify(branch, null, 2), {
            contentType: 'application/json',
          });
        }
      })
  );
  
  console.log('reparented')
  // Step 8: Delete metadata file last
  await branchMetaFile.delete().catch(() => null);
}

async function mergeBranch(repoName, sourceBranch) {
  const basePath = `repos/${repoName}/`;
  const repoFile = bucket.file(`${basePath}repo.json`);
  const [repoRaw] = await repoFile.download();
  const repo = JSON.parse(repoRaw.toString());
  let currentBranch = repo.current_branch;

  const sourceBranchFile = bucket.file(`${basePath}branches/${sourceBranch}_repo.json`);
  const sourceBranchData = JSON.parse((await sourceBranchFile.download())[0].toString());

  const branchFiles = (await bucket.getFiles({ prefix: `${basePath}branches/` }))[0]
    .filter(f => f.name.endsWith('_repo.json'));

  // Determine merge direction (reverse if source is higher in the tree)
  let targetBranch = currentBranch;
  let targetBranchFile = bucket.file(`${basePath}branches/${targetBranch}_repo.json`);
  let targetBranchData = JSON.parse((await targetBranchFile.download())[0].toString());

  const isSourceParent = sourceBranchData.subBranches?.includes(targetBranch);
// const isTargetParent = sourceBranchData.subBranches?.includes(targetBranch);

// Force merges to go INTO main if it's involved
const mainOverride = (targetBranch !== 'main' && sourceBranch === 'main');

// If main is source, or source is higher → reverse
if (mainOverride || isSourceParent) {
  targetBranch = sourceBranch;
  targetBranchFile = sourceBranchFile;
  targetBranchData = sourceBranchData;
  sourceBranch = currentBranch;

  repo.current_branch = targetBranch;
  await repoFile.save(JSON.stringify(repo, null, 2));
}


  // Load workspaces
  const sourcePrefix = `${basePath}branches/${sourceBranch}/workspace/`;
  const targetPrefix = `${basePath}branches/${targetBranch}/workspace/`;

  const [sourceFiles, targetFiles] = await Promise.all([
    bucket.getFiles({ prefix: sourcePrefix }),
    bucket.getFiles({ prefix: targetPrefix }),
  ]);

  const getFileMap = async (files, prefix) => {
    const map = {};
    for (const file of files[0]) {
      const rel = file.name.replace(prefix, '');
      const [buffer] = await file.download();
      map[rel] = buffer.toString('base64');
    }
    return map;
  };

  const [sourceMap, targetMap] = await Promise.all([
    getFileMap(sourceFiles, sourcePrefix),
    getFileMap(targetFiles, targetPrefix),
  ]);

  // Conflict detection
  const conflicts = Object.keys(sourceMap).filter(
    f => targetMap[f] && targetMap[f] !== sourceMap[f]
  );

  if (conflicts.length > 0) {
    const err = new Error('Merge conflict detected');
    err.conflict = true;
    err.conflicts = conflicts;
    throw err;
  }

  // Copy source workspace files into target workspace
  await Promise.all(
    sourceFiles[0].map(async (file) => {
      const rel = file.name.replace(sourcePrefix, '');
      const [buffer] = await file.download();
      await bucket.file(`${targetPrefix}${rel}`).save(buffer, {
        contentType: file.metadata.contentType,
      });
    })
  );

  // Create a new merge commit
  const mergeCommitId = Date.now().toString();
  const mergeMessage = `Merge ${sourceBranch} into ${targetBranch}`;
  const [mergedFiles] = await bucket.getFiles({ prefix: targetPrefix });

  await Promise.all(
    mergedFiles.map(async (file) => {
      const relative = file.name.replace(targetPrefix, '');
      const [buffer] = await file.download();
      await bucket.file(`${basePath}commits/${mergeCommitId}/${relative}`).save(buffer, {
        contentType: file.metadata.contentType,
      });
    })
  );

  const mergeCommitEntry = { id: mergeCommitId, message: mergeMessage };
  targetBranchData.commits.push(mergeCommitEntry);
  repo.commits.push(mergeCommitEntry);

  // Inherit subBranches from sourceBranch
  const inheritedSubBranches = sourceBranchData.subBranches || [];
  targetBranchData.subBranches = [
    ...(targetBranchData.subBranches || []).filter(b => b !== sourceBranch),
    ...inheritedSubBranches
  ];

  // Save updated metadata
  await Promise.all([
    targetBranchFile.save(JSON.stringify(targetBranchData, null, 2)),
    repoFile.save(JSON.stringify(repo, null, 2)),
  ]);

  // Update other branches that referenced sourceBranch
  await Promise.all(
    branchFiles.map(async (file) => {
      const [raw] = await file.download();
      const data = JSON.parse(raw.toString());

      if (data.subBranches?.includes(sourceBranch)) {
        data.subBranches = data.subBranches
          .filter(b => b !== sourceBranch)
          .concat(inheritedSubBranches);

        await file.save(JSON.stringify(data, null, 2));
      }
    })
  );

  // Clear subBranches of sourceBranch (they were inherited)
  sourceBranchData.subBranches = [];
  await sourceBranchFile.save(JSON.stringify(sourceBranchData, null, 2));

  // Delete source branch
  await deleteBranch(repoName, sourceBranch);

  return {
    mergedInto: targetBranch,
    commitId: mergeCommitId,
    message: mergeMessage
  };
}

async function getBranchTree(repoName) {
  const basePath = `repos/${repoName}/`;
  const repoFile = bucket.file(`${basePath}repo.json`);
  const [repoRaw] = await repoFile.download();
  const repoData = JSON.parse(repoRaw.toString());
  const root = repoData.defaultBranch || 'main';

  async function buildBranchNode(branchName) {
    const branchFile = bucket.file(`${basePath}branches/${branchName}_repo.json`);
    const [raw] = await branchFile.download();
    const data = JSON.parse(raw.toString());
    console.log('branch data',data)
    const children = await Promise.all(
      (data.subBranches || []).map(buildBranchNode)
    );

    return {
      name: branchName,
      createdAt: data.createdAt,
      commits: data.commits,
      subBranches: data.subBranches,
      children
    };
  }

  return await buildBranchNode(root);
}

module.exports = {
  createBranch,
  switchBranch,
  deleteBranch,
  mergeBranch,
  getBranchTree
};

