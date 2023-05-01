import type { Logger, QueryRunner } from "typeorm";
import type { TypeormDataSource, TypeormValueObject } from "./types";
import { TypeormHookName } from "./types";

export class TypeormPluginLogger implements Logger {
  constructor(public valueObject: TypeormValueObject<string>, public dataSource: TypeormDataSource<string>) {}

  log(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "log", query, parameters, queryRunner, dataSourceName: this.dataSource.name },
    });
  }

  logMigration(message: string, queryRunner?: QueryRunner) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "logMigration", message, queryRunner, dataSourceName: this.dataSource.name },
    });
  }

  logQuery(query: string, parameters?: any[] | undefined, queryRunner?: QueryRunner) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "logQuery", query, parameters, queryRunner, dataSourceName: this.dataSource.name },
    });
  }

  logQueryError(error: string | Error, query: string, parameters?: any[] | undefined, queryRunner?: QueryRunner) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "logQueryError", error, query, parameters, queryRunner, dataSourceName: this.dataSource.name },
    });
  }

  logQuerySlow(time: number, query: string, parameters?: any[] | undefined, queryRunner?: QueryRunner) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "logQuerySlow", time, query, parameters, queryRunner, dataSourceName: this.dataSource.name },
    });
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    void this.valueObject.runHooks({
      name: TypeormHookName.ormLogged,
      payload: { name: "logSchemaBuild", message, queryRunner, dataSourceName: this.dataSource.name },
    });
  }
}
