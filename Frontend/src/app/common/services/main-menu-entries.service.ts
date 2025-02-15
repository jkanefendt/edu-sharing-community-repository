import { Injectable } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { AsyncSubject, Observable } from 'rxjs';
import { BridgeService } from '../../core-bridge-module/bridge.service';
import {
    ConfigurationService,
    FrameEventsService,
    LoginResult,
    RestConnectorService,
    RestConstants,
    UIConstants,
    UIService,
    AccessScope,
    RestOrganizationService,
    OrganizationOrganizations,
    RestMediacenterService,
} from '../../core-module/core.module';
import { OPEN_URL_MODE } from '../../core-module/ui/ui-constants';
import { UIHelper } from '../../core-ui-module/ui-helper';
import {ConfigEntry} from '../../core-ui-module/node-helper.service';

type Target = { type: 'path'; path: string } | { type: 'url'; url: string; openInNew: boolean };

interface CustomEntryDefinition {
    name: string;
    icon: string;
    position: number;
    path?: string;
    url?: string;
    scope?: string;
    isDisabled?: boolean;
    openInNew?: boolean;
    isSeperate?: boolean;
    onlyDesktop?: boolean;
    onlyWeb?: boolean;
}

interface EntryDefinition {
    name: string;
    icon: string;
    target: Target;
    scope: string;
    isVisible: (() => boolean) | true;
}

@Injectable()
export class MainMenuEntriesService {
    entries$: Observable<ConfigEntry[]>;

    private entries = new AsyncSubject<ConfigEntry[]>();

    // Initialized on construction.
    private config: {
        menuEntries?: CustomEntryDefinition[];
        hideMainMenu?: string[];
        stream?: { enabled: boolean };
    };
    private loginInfo: LoginResult;

    // Conditionally initialized on construction.
    private safeScope: AccessScope;
    private organizations: OrganizationOrganizations;
    private mediaCenters: { administrationAccess: boolean }[];

    private readonly defaultEntryDefinitions: EntryDefinition[] = [
        {
            name: 'SIDEBAR.WORKSPACE',
            icon: 'cloud',
            target: { type: 'path', path: 'workspace/files' },
            scope: 'workspace',
            isVisible: () =>
                !this.loginInfo.isGuest && this.canAccessWorkspace(),
        },
        {
            name: 'SIDEBAR.SEARCH',
            icon: 'search',
            target: { type: 'path', path: 'search' },
            scope: 'search',
            isVisible: true,
        },
        {
            name: 'SIDEBAR.COLLECTIONS',
            icon: 'layers',
            target: { type: 'path', path: 'collections' },
            scope: 'collections',
            isVisible: true,
        },
        {
            name: 'SIDEBAR.STREAM',
            icon: 'event',
            target: { type: 'path', path: 'stream' },
            scope: 'stream',
            isVisible: () => this.config.stream?.enabled && !this.loginInfo.isGuest,
        },
        {
            name: 'SIDEBAR.LOGIN',
            icon: 'person',
            target: { type: 'path', path: 'login' },
            scope: 'login',
            isVisible: () => this.loginInfo.isGuest,
        },
        {
            name: 'SIDEBAR.SECURE',
            icon: 'lock',
            target: { type: 'path', path: 'workspace/safe' },
            scope: 'safe',
            isVisible: () => !this.bridge.isRunningCordova() && this.safeScope.hasAccess,
        },
        {
            name: 'SIDEBAR.PERMISSIONS',
            icon: 'group_add',
            target: { type: 'path', path: 'permissions' },
            scope: 'permissions',
            isVisible: () =>
                !this.ui.isMobile() &&
                (this.organizations.canCreate ||
                    this.organizations.organizations.filter(
                        group => group.administrationAccess,
                    ).length > 0),
        },
        {
            name: 'SIDEBAR.ADMIN',
            icon: 'settings',
            scope: 'admin',
            target: { type: 'path', path: 'admin' },
            isVisible: () => !this.ui.isMobile() && this.showAdminEntry(),
        },
    ];

    constructor(
        private bridge: BridgeService,
        private configuration: ConfigurationService,
        private frameEvents: FrameEventsService,
        private restConnector: RestConnectorService,
        private restMediacenter: RestMediacenterService,
        private restOrganization: RestOrganizationService,
        private route: ActivatedRoute,
        private router: Router,
        private ui: UIService,
    ) {
        this.entries$ = this.entries.asObservable();
        this.init();
    }

    private async init() {
        await this.initInformation();
        this.initEntries();
    }

    private async initInformation() {
        // Fetch information in parallel as far as possible.
        await Promise.all([
            this.configuration
                .getAll()
                .toPromise()
                .then(config => (this.config = config)),
            this.restConnector
                .isLoggedIn(false)
                .toPromise()
                .then(loginInfo => (this.loginInfo = loginInfo)),
            this.restConnector
                .hasAccessToScope(RestConstants.SAFE_SCOPE)
                .toPromise()
                .then(safeScope => (this.safeScope = safeScope)),
        ]);
        // The backend will throw some errors when making unauthorized calls, so we only initialize
        // these variables when we will need them.
        if (this.loginInfo.isValidLogin && !this.ui.isMobile()) {
            await Promise.all([
                this.restOrganization
                    .getOrganizations()
                    .toPromise()
                    .then(
                        organizations => (this.organizations = organizations),
                    ),
                this.restMediacenter
                    .getMediacenters()
                    .toPromise()
                    .then(mediaCenters => (this.mediaCenters = mediaCenters)),
            ]);
        }
    }

    private initEntries() {
        let entries: ConfigEntry[] = [];
        if (this.loginInfo.isValidLogin) {
            entries = this.generateEntries();
            entries = this.filterHiddenEntries(entries);
        }
        entries = this.insertCustomEntries(entries);
        this.entries.next(entries);
        this.entries.complete();
    }

    private generateEntries(): ConfigEntry[] {
        const entries: ConfigEntry[] = [];
        for (const entryDefinition of this.defaultEntryDefinitions) {
            const isVisible =
                typeof entryDefinition.isVisible === 'function'
                    ? entryDefinition.isVisible()
                    : entryDefinition.isVisible;
            if (isVisible) {
                entries.push(this.generateEntry(entryDefinition));
            }
        }
        return entries;
    }

    private filterHiddenEntries(entries: ConfigEntry[]): ConfigEntry[] {
        if (this.config.hideMainMenu) {
            return entries.filter(
                entry => !this.config.hideMainMenu.includes(entry.scope),
            );
        } else {
            return entries;
        }
    }

    private insertCustomEntries(entries: ConfigEntry[]): ConfigEntry[] {
        if (this.config.menuEntries) {
            for (const customEntryDefinition of this.config.menuEntries) {
                if (customEntryDefinition.onlyDesktop && this.ui.isMobile()) {
                    continue;
                } else if (customEntryDefinition.onlyWeb && this.bridge.isRunningCordova()) {
                    continue;
                }
                let pos = customEntryDefinition.position;
                if (pos < 0) {
                    pos = entries.length - pos;
                }
                entries.splice(
                    pos,
                    0,
                    this.generateCustomEntry(customEntryDefinition),
                );
            }
        }
        return entries;
    }

    private generateEntry(entryDefinition: EntryDefinition): ConfigEntry {
        const entry = {
            name: entryDefinition.name,
            icon: entryDefinition.icon,
            scope: entryDefinition.scope,
            isDisabled: false,
            isSeparate: false,
            isCustom: false,
            open: () => this.openEntry(entry, entryDefinition.target),
        };
        return entry;
    }

    private generateCustomEntry(
        customEntryDefinition: CustomEntryDefinition,
    ): ConfigEntry {
        const target: Target = customEntryDefinition.path
            ? { type: 'path', path: customEntryDefinition.path }
            : {
                  type: 'url',
                  url: customEntryDefinition.url,
                  openInNew: customEntryDefinition.openInNew ?? true,
              };
        const entry = {
            name: customEntryDefinition.name,
            icon: customEntryDefinition.icon,
            scope: customEntryDefinition.scope,
            isDisabled: !!customEntryDefinition.isDisabled,
            isSeparate: !!customEntryDefinition.isSeperate,
            isCustom: true,
            open: () => { this.openEntry(entry, target); },
        };
        return entry;
    }

    private canAccessWorkspace(): boolean {
        return (
            this.loginInfo.toolPermissions &&
            this.loginInfo.toolPermissions.indexOf(
                RestConstants.TOOLPERMISSION_WORKSPACE,
            ) !== -1
        );
    }

    private showAdminEntry(): boolean {
        return (
            this.loginInfo.isAdmin ||
            this.loginInfo.toolPermissions.indexOf(
                RestConstants.TOOLPERMISSION_GLOBAL_STATISTICS_NODES,
            ) !== -1 ||
            this.loginInfo.toolPermissions.indexOf(
                RestConstants.TOOLPERMISSION_GLOBAL_STATISTICS_USER,
            ) !== -1 ||
            this.mediaCenters.filter(mc => mc.administrationAccess).length > 0
        );
    }

    private async openEntry(entry: ConfigEntry, target: Target): Promise<void> {
        this.frameEvents.broadcastEvent(
            FrameEventsService.EVENT_VIEW_SWITCHED,
            entry.scope,
        );
        switch (target.type) {
            case 'path':
                const currentParams = await this.route.queryParams
                    .first()
                    .toPromise();
                const params: Params = {};
                for (const key of ['reurl', 'applyDirectories']) {
                    if (currentParams.hasOwnProperty(key)) {
                        params[key] = currentParams[key];
                    }
                }
                this.router.navigate(
                    [UIConstants.ROUTER_PREFIX + target.path],
                    {
                        queryParams: params,
                    },
                );
                break;
            case 'url':
                const mode = target.openInNew
                    ? OPEN_URL_MODE.BlankSystemBrowser
                    : OPEN_URL_MODE.Current;
                UIHelper.openUrl(
                    target.url,
                    this.bridge,
                    mode,
                );
                break;
        }
    }
}
