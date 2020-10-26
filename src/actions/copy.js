import fs from 'fs';
import path from 'path';

import fsExtra from 'fs-extra';
import cpy from 'cpy';
import isGlob from 'is-glob';

const copy = async (task) => {
  const { source, absoluteSource, absoluteDestination, context, toType } = task;

  try {
    if (isGlob(source)) {
      const src = path.posix.join(context, source);
      await cpy(src, absoluteDestination);
    } else {
      const isSourceFile = fs.lstatSync(absoluteSource).isFile();

      // if source is a file and target is a directory
      // create the directory and copy the file into that directory
      if (isSourceFile && toType === 'dir') {
        await fsExtra.ensureDir(absoluteDestination);

        const sourceFileName = path.basename(absoluteSource);
        const filePath = path.resolve(absoluteDestination, sourceFileName);

        await fsExtra.copy(absoluteSource, filePath);
        return;
      }

      await fsExtra.copy(absoluteSource, absoluteDestination);
    }
  } catch (err) {}
};

const copyAction = async (tasks) => {
  const taskMap = tasks.map(copy);

  for (const task of taskMap) {
    await task;
  }
};

export default copyAction;
