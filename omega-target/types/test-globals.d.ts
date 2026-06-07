declare var before: (callback: () => unknown) => unknown;
declare var after: (callback: () => unknown) => unknown;
declare var describe: (name: string, callback: () => unknown) => unknown;
declare var it: (name: string, callback: (done?: () => void) => unknown) => unknown;
declare function require(id: string): any;

interface Object {
  should: any;
}

interface String {
  should: any;
}

interface Number {
  should: any;
}

interface Boolean {
  should: any;
}
