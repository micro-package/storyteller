import type { Logger } from "typeorm";
import type { TypeormDataSource, TypeormValueObject } from "./types";
import { TypeormHookName } from "./types";

export class TypeormPluginLogger implements Logger {
  constructor(public valueObject: TypeormValueObject<string>, public dataSource: TypeormDataSource<string>) {}

  log(query: string, parameters?: any[]) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "log", query, parameters, dataSourceName: this.dataSource.name },
    });
  }

  logMigration(message: string) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "logMigration", message, dataSourceName: this.dataSource.name },
    });
  }

  logQuery(query: string, parameters?: any[] | undefined) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "logQuery", query, parameters, dataSourceName: this.dataSource.name },
    });
  }

  logQueryError(error: string | Error, query: string, parameters?: any[] | undefined) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "logQueryError", error, query, parameters, dataSourceName: this.dataSource.name },
    });
  }

  logQuerySlow(time: number, query: string, parameters?: any[] | undefined) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "logQuerySlow", time, query, parameters, dataSourceName: this.dataSource.name },
    });
  }

  logSchemaBuild(message: string) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "logSchemaBuild", message, dataSourceName: this.dataSource.name },
    });
  }
}
