import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../../shared/header/header';
import { Footer } from '../../shared/footer/footer';
import { PageHero } from '../../shared/components/page-hero/page-hero';

@Component({
  selector: 'app-china-to-tanzania-cargo',
  imports: [RouterLink, Header, Footer, PageHero],
  templateUrl: './china-to-tanzania-cargo.html',
})
export class ChinaToTanzaniaCargo {
  readonly questions = [
    {
      question: 'How much does shipping cargo from China to Tanzania cost?',
      answer: 'Ask your chosen agent for a quote for your actual goods. Share the weight, dimensions, quantity, collection point, and destination. Confirm the currency, charging unit, and every included or additional charge before you book.',
    },
    {
      question: 'How long will my cargo take to arrive?',
      answer: 'Confirm the current collection schedule, departure arrangements, estimated arrival, and final delivery with your agent. Ask when the estimate starts and how you will hear about delays. Pilikapilika does not publish a guaranteed transit time for every agent or shipment.',
    },
    {
      question: 'Can I compare air cargo and sea cargo agents?',
      answer: 'Browse agent profiles and available transport methods, then contact an agent to confirm whether they offer air or sea cargo on the China-to-Tanzania route. Agree on the service that fits your goods, delivery needs, and quoted cost.',
    },
    {
      question: 'Do I need an account to find a cargo agent?',
      answer: 'You can browse public agent profiles without an account. Create an account and complete your profile to use shipment booking and account tools. Pilikapilika connects you with logistics agents; confirm route coverage and shipment arrangements with the agent you choose.',
    },
  ];
}
