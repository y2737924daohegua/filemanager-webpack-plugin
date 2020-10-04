import validateOptions from 'schema-utils';

import { copyAction, moveAction, mkdirAction, archiveAction, deleteAction } from './actions';

import schema from './options-schema';

const PLUGIN_NAME = 'FileManagerPlugin';

class FileManagerPlugin {
  constructor(options) {
    validateOptions(schema, options, {
      name: PLUGIN_NAME,
      baseDataPath: 'options',
    });

    this.options = this.setOptions(options);
  }

  setOptions(userOptions) {
    const defaultOptions = {
      verbose: false,
      moveWithMkdirp: false,
      onStart: {},
      onEnd: {},
    };

    for (const key in defaultOptions) {
      if (userOptions.hasOwnProperty(key)) {
        defaultOptions[key] = userOptions[key];
      }
    }

    return defaultOptions;
  }

  checkOptions(stage) {
    if (this.options.verbose && Object.keys(this.options[stage]).length) {
      console.log(`FileManagerPlugin: processing ${stage} event`);
    }

    let operationList = [];

    if (this.options[stage] && Array.isArray(this.options[stage])) {
      this.options[stage].map((opts) => operationList.push(...this.parseFileOptions(opts, true)));
    } else {
      operationList.push(...this.parseFileOptions(this.options[stage]));
    }

    if (operationList.length) {
      operationList.reduce((previous, fn) => {
        return previous.then((retVal) => fn(retVal)).catch((err) => console.log(err));
      }, Promise.resolve());
    }
  }

  replaceHash(filename) {
    return filename.replace('[hash]', this.fileHash);
  }

  processAction(action, params, commandOrder) {
    const options = {
      ...this.options,
      context: this.context,
    };
    const result = action(params, options);

    if (result !== null) {
      commandOrder.push(result);
    }
  }

  parseFileOptions(options) {
    let commandOrder = [];

    Object.keys(options).forEach((actionType) => {
      const actionOptions = options[actionType];
      let actionParams = null;

      actionOptions.forEach((actionItem) => {
        switch (actionType) {
          case 'copy':
            actionParams = Object.assign(
              { source: this.replaceHash(actionItem.source) },
              actionItem.destination && { destination: actionItem.destination }
            );

            this.processAction(copyAction, actionParams, commandOrder);

            break;

          case 'move':
            actionParams = Object.assign(
              { source: this.replaceHash(actionItem.source) },
              actionItem.destination && { destination: actionItem.destination }
            );

            this.processAction(moveAction, actionParams, commandOrder);

            break;

          case 'delete':
            if (!Array.isArray(actionOptions) || typeof actionItem !== 'string') {
              throw Error(`  - FileManagerPlugin: Fail - delete parameters has to be an array of strings`);
            }

            actionParams = Object.assign({ source: this.replaceHash(actionItem) });
            this.processAction(deleteAction, actionParams, commandOrder);

            break;

          case 'mkdir':
            actionParams = { source: this.replaceHash(actionItem) };
            this.processAction(mkdirAction, actionParams, commandOrder);

            break;

          case 'archive':
            actionParams = {
              source: this.replaceHash(actionItem.source),
              destination: actionItem.destination,
              format: actionItem.format ? actionItem.format : 'zip',
              options: actionItem.options ? actionItem.options : { zlib: { level: 9 } },
            };

            this.processAction(archiveAction, actionParams, commandOrder);

            break;

          default:
            break;
        }
      });
    });

    return commandOrder;
  }

  apply(compiler) {
    this.context = compiler.options.context;

    const comp = (compilation) => {
      try {
        this.checkOptions('onStart');
      } catch (error) {
        compilation.errors.push(error);
      }
    };

    const afterEmit = (compilation, cb) => {
      this.fileHash = compilation.hash;

      try {
        this.checkOptions('onEnd');
      } catch (error) {
        compilation.errors.push(error);
      }

      cb();
    };

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, comp);
    compiler.hooks.afterEmit.tapAsync(PLUGIN_NAME, afterEmit);
  }
}

export default FileManagerPlugin;
