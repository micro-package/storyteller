import dotenv from "dotenv";
import { typeormPlugin } from ".";
import { Column, DataSource, Entity, PrimaryGeneratedColumn } from "typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";
import { expect } from "@jest/globals";
import { createValueObject, forgeValueObject } from "../../container/value-object";
import { storytellerPlugin, storytellerHelper } from "../storyteller";
import { normalize } from "path";
import { pipe } from "ts-pipe-compose";
const { parsed: env } = dotenv.config({ path: normalize(`${__dirname}/../../../.env.dist`) });
if (
  env === undefined ||
  env.POSTGRES_USERNAME === undefined ||
  env.POSTGRES_PASSWORD === undefined ||
  env.POSTGRES_DB === undefined
) {
  throw Error("Test has missing env variables");
}
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  isActive: boolean;
}

enum StepName {
  stepArrange = "stepArrange",
  stepAct = "stepAct",
  stepAssert = "stepAssert",
}

enum DataSourceName {
  postgres1 = "postgres1",
}
const testFramework = pipe(
  createValueObject(),
  storytellerPlugin<StepName>({}),
  typeormPlugin({
    dataSources: [
      {
        name: DataSourceName.postgres1,
        dataSource: new DataSource({
          type: "postgres",
          host: "postgres",
          port: 5432,
          username: env.POSTGRES_USERNAME,
          password: env.POSTGRES_PASSWORD,
          database: env.POSTGRES_DB,
          entities: [User],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
      },
    ],
  }),
  forgeValueObject({ debug: false }),
  storytellerHelper,
);

describe("typeorm", () => {
  it(
    "basic test",
    testFramework.createStory({
      arrange: testFramework.createStep({
        name: StepName.stepArrange,
        handler: async (valueObject) => {
          await valueObject
            .typeormGetManager({ name: DataSourceName.postgres1 })
            .getRepository(User)
            .insert({ firstName: "zxc", lastName: "qwe", isActive: true });
        },
      }),
      act: testFramework.createStep({
        name: StepName.stepAct,
        handler: async (valueObject) => {
          await valueObject
            .typeormGetManager({ name: DataSourceName.postgres1 })
            .getRepository(User)
            .createQueryBuilder()
            .select("first_name")
            .groupBy("first_name")
            .where({ isActive: true })
            .getMany();
        },
      }),
      assert: testFramework.createStep({
        name: StepName.stepAssert,
        handler: async (valueObject) => {
          expect(valueObject.typeormGetChains({ name: DataSourceName.postgres1 })).toStrictEqual([
            [
              {
                name: "getRepository",
                args: [User],
              },
              {
                name: "insert",
                args: [{ firstName: "zxc", lastName: "qwe", isActive: true, id: expect.any(Number) }],
              },
            ],
            [
              {
                name: "getRepository",
                args: [User],
              },
              {
                name: "createQueryBuilder",
                args: [],
              },
              {
                name: "select",
                args: ["first_name"],
              },
              {
                name: "groupBy",
                args: ["first_name"],
              },
              {
                name: "where",
                args: [{ isActive: true }],
              },
              {
                name: "getMany",
                args: [],
              },
            ],
          ]);
        },
      }),
    }),
  );
});
