import { Routes } from '@angular/router';
import { DiceAnalysisPage } from './features/dice-analysis/pages/dice-analysis-page/dice-analysis-page';
import { DiceThrowPage } from './features/dice-throw/pages/dice-throw-page/dice-throw-page';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'dice-throw',
	},
	{
		path: 'dice-throw',
		component: DiceThrowPage,
	},
	{
		path: 'dice-analysis',
		component: DiceAnalysisPage,
	},
	{
		path: '**',
		redirectTo: 'dice-throw',
	},
];
