import { DependencyContainer } from "tsyringe";
import crypto from "crypto";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { DialogueHelper } from "@spt/helpers/DialogueHelper";
import { IPostAkiLoadMod } from "@spt/models/external/IPostAkiLoadMod";
import type { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { ImageRouter } from "@spt/routers/ImageRouter";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { ITraderConfig, UpdateTime } from "@spt/models/spt/config/ITraderConfig";
import { IInventoryConfig } from "@spt/models/spt/config/IInventoryConfig";
import { IModLoader } from "@spt/models/spt/mod/IModLoader";
import { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { Traders } from "@spt/models/enums/Traders";
import { QuestStatus } from "@spt/models/enums/QuestStatus";
import { MessageType } from "@spt/models/enums/MessageType";
import { HashUtil } from "@spt/utils/HashUtil";
import { VFS } from "@spt/utils/VFS"
import { NotificationSendHelper } from "@spt/helpers/NotificationSendHelper";
import { NotifierHelper } from "@spt/helpers/NotifierHelper";
import { QuestHelper } from "@spt/helpers/QuestHelper";
import { ImporterUtil } from "@spt/utils/ImporterUtil"
import { BundleLoader } from "@spt/loaders/BundleLoader";
import { VulcanCommon } from "../../[火神之心]VulcanCore/src/vulcan-api/Common";
import { IQuestConfig } from "@spt/models/spt/config/IQuestConfig";
//
class Mod implements IPreSptLoadMod {
    public preSptLoad(container: DependencyContainer): void {
    }
    public postDBLoad(container: DependencyContainer): void {
        const PreSptModLoader = container.resolve("PreSptModLoader");
        const FuncDatabaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const FuncImporterUtil = container.resolve<ImporterUtil>("ImporterUtil")
        const VFS = container.resolve<VFS>("VFS");
        const JsonUtil = container.resolve<JsonUtil>("JsonUtil");
        const common = container.resolve<VulcanCommon>("VulcanCommon")
        const ClientDB = FuncDatabaseServer.getTables();
        const ModPath = PreSptModLoader.getModPath("罗德岛驻塔科夫贸易中心")
        const DB = FuncImporterUtil.loadRecursive(`${ModPath}db/`)
        const Package = FuncImporterUtil.loadRecursive(`${ModPath}package/`)
        const imageRouter = container.resolve<ImageRouter>("ImageRouter");
        const configServer = container.resolve<ConfigServer>("ConfigServer");
        const inventoryConfig = configServer.getConfig<IInventoryConfig>(ConfigTypes.INVENTORY);
        const questConfig = configServer.getConfig<IQuestConfig>(ConfigTypes.QUEST);
        common.Log("正在尝试与Rhodes Island™取得神经连接……")
        common.waitForTime(2)
        common.Log("开始加载扩展包……")
        var PackInfo = {}
        var PackCount = 0
        for (let pack in Package) {
            var info = Package[pack].package
            PackInfo[pack] = {}
            PackInfo[pack].Name = info.Name
            PackInfo[pack].Desc = info.Desc
            PackInfo[pack].Version = info.Version
            PackCount++
            const PackagePath = `${ModPath}package/${info.pathname}/`
            const PackageItem = FuncImporterUtil.loadRecursive(`${PackagePath}items/`)
            const PackageTrader = FuncImporterUtil.loadRecursive(`${PackagePath}traders/`)
            const PackageLocale = FuncImporterUtil.loadRecursive(`${PackagePath}res/locale/`)
            const PackageQuest = PackageTrader.questdata
            common.Log(`发现扩展包：${info.Name}`)
            common.Log("开始解析扩展包……")
            common.Log("加载自定义资源文件……")
            common.addCustomBundles(`${PackagePath}`)
            const iconList = VFS.getFiles(`${PackagePath}res/image/`);
            for (const icon of iconList) {
                const filename = VFS.stripExtension(icon);
                imageRouter.addRoute(`/files/quest/icon/${filename}`, `${PackagePath}res/image/${icon}`);
            }
            common.Log("反序列化物品数据……")
            common.initItemRITC(PackageItem.ritcitem, 1)
            common.initItemRITC(PackageItem.mgitem, 2)
            common.initItemRITC(PackageItem.superitem, 3)
            common.initGiftData(PackageTrader.GiftData)
            common.initPreset(PackageTrader.PresetData)
            for(var i = 0; i < info.Config.CustomMoney.length; i++){
                inventoryConfig.customMoneyTpls.push(info.Config.CustomMoney[i])
            }
            for(var i = 0; i < info.Config.LootBlackList.length; i++){
                common.excludeItem(info.Config.LootBlackList[i])
            }
            for(let i in info.Config.GenerateList){
                common.addWorldGenerate(i, info.Config.GenerateList[i])
            }
            for(var i = 0; i < info.Config.CustomRagfairBlackList.length; i++){
                ClientDB.templates.items[info.Config.CustomRagfairBlackList[i]]._props.CanSellOnRagfair = false
            }
            for(var i = 0; i < info.Config.CustomRagfairWhiteList.length; i++){
                ClientDB.templates.items[info.Config.CustomRagfairWhiteList[i]]._props.CanSellOnRagfair = true
            }
            common.Log("反序列化商人数据……")
            common.initTradersRITC(info, PackageTrader, PackagePath)
            common.Log("反序列化任务数据……")
            common.initQuest(PackageQuest.initQuest)
            common.initQuestCond(PackageQuest.QuestConditions)
            common.initQuestReward(PackageQuest.QuestRewards) 
            common.loadQuestLocaleRITC(info, PackageLocale.quest)
            common.initLocaleRITC(info, PackageLocale.text)
            common.initDailyQuest(PackageQuest.RepeatableQuests)
            common.Log("反序列化交易数据……")
            common.initAssortData(PackageTrader.AssortData) 
            common.Log("反序列化配方数据……")
            common.initRecipe(PackageTrader.RecipeData)
            common.initScavCase(PackageTrader.ScavCaseData)

            common.Log("扩展包解析完成。")
        }
        const https = require('https');
        function fetchData() {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: 'api.example.com',
                    path: '/data',
                    method: 'GET'
                };
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        resolve(JSON.parse(data));
                    });
                });
                req.on('error', (error) => {
                    reject(error);
                });
                req.end();
            });
        }
        fetchData()
            .then(data => {
                //console.log('Fetched data:', data);
            })
            .catch(error => {
                //console.error('Error:', error);
                var packstr = ""
                for(let i in PackInfo){
                    //common.Log(`${PackInfo[i].Name}: ${PackInfo[i].Desc}`)
                    packstr += `${PackInfo[i].Name}\n版本: ${PackInfo[i].Version}\n说明: ${PackInfo[i].Desc}\n`
                }
                common.Log(`\nRITC: 共加载了${PackCount}个扩展包。\n扩展包列表: \n${packstr}`)
            });
        //VFS.writeFile(`${ModPath}export.json`, JSON.stringify(questConfig.repeatableQuests, null, 4))
        /*
        var ItemMap = {}
        var QuestMap = {}
        for(let i in Package.RITCExample.SearchMap.items){
            if(Package.RITCExample.SearchMap.items[i]._props?.Prefab?.path.length>0){
                ItemMap[Package.RITCExample.SearchMap.items[i]._id] = {}
                ItemMap[Package.RITCExample.SearchMap.items[i]._id].ID = Package.RITCExample.SearchMap.items[i]._id
                ItemMap[Package.RITCExample.SearchMap.items[i]._id].Name = Locale[`${Package.RITCExample.SearchMap.items[i]._id} Name`]
                ItemMap[Package.RITCExample.SearchMap.items[i]._id].ShortName = Locale[`${Package.RITCExample.SearchMap.items[i]._id} ShortName`]
                ItemMap[Package.RITCExample.SearchMap.items[i]._id].Description = Locale[`${Package.RITCExample.SearchMap.items[i]._id} Description`]
            }
        }
        for(let q in Package.RITCExample.SearchMap.quests){
            QuestMap[q] = {}
            QuestMap[q].ID = Package.RITCExample.SearchMap.quests[q]._id
            QuestMap[q].Name = Locale[`${Package.RITCExample.SearchMap.quests[q]._id} name`]
            QuestMap[q].Description = Locale[`${Package.RITCExample.SearchMap.quests[q]._id} description`]
            QuestMap[q].Trader = Locale[`${Package.RITCExample.SearchMap.quests[q].traderId} Nickname`]
            QuestMap[q].Conditions = {}
            for(var c = 0; c < Package.RITCExample.SearchMap.quests[q].conditions.AvailableForFinish.length; c++){
                QuestMap[q].Conditions[Package.RITCExample.SearchMap.quests[q].conditions.AvailableForFinish[c].id] = Locale[`${Package.RITCExample.SearchMap.quests[q].conditions.AvailableForFinish[c].id}`]
            }

        }
        */
        //VFS.writeFile(`${ModPath}ItemMap.json`, JSON.stringify(ItemMap, null, 4))
        //VFS.writeFile(`${ModPath}QuestMap.json`, JSON.stringify(QuestMap, null, 4))
        //common.initItem(DB.templates.items, 1)
        //common.initItem(DB.templates.mgitem, 2)
        //common.initItem(DB.templates.superitem, 3)
        //common.addCustomBundles(`${ModPath}db/templates/test/`)
    }
}
module.exports = { mod: new Mod() }